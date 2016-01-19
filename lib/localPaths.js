var async = require('async'),
    TransferPatternGraphAggregator = require('./dagAggregator.js'),
    TransferPatternGraphBuilder = require('./dagBuilder.js'),
    Fetcher = require('lc-client').Fetcher,
    TransferPatternBuilder = require('./localPathBuilder.js'),
    Planner = require('csa').BasicCSA,
    Q = require('q'),
    stream = require('stream'),
    util = require('util'),
    _und = require("underscore");

// The following line is necessary because otherwise a memory leak warning will be issued.
// See for example "Concurrent Handlers" on http://www.jongleberry.com/understanding-possible-eventemitter-leaks.html.
require('events').EventEmitter.defaultMaxListeners = Infinity;

/**
 * Transforms the result of ClusterAlgorithm into a graph of transfer patterns.
 * Everything is calculated in terms of the clustering result written to this stream.
 * The graphs produced by this stream are grouped per cluster in an associative array.
 * The output of this stream consists of an object with the following values:
 * graphs: see "TransferPatternGraphAggregator"
 * convexity: see "TransferPatternGraphAggregator"
 * borderStations: mapping of station id to boolean indicating wether this station is a border station
 * @param startDate Starting point in time for connection scan.
 * @param increment Scan every "increment" minutes
 * @param maxMinutes Maximum increment value
 * @param entryPoints Entry points for the linked connections client (See documentation on linked connections.)
 * NOTE: the transfer pattern graphs will only be valid for journeys in the time range
 * represented by startDate, increment and maxMinutes.
 */
var AllTransferPatternsCalculator = function (startDate, increment, maxMinutes, entryPoints) {
  stream.Transform.call(this, {objectMode : true});
  this._startDate = startDate;
  this._increment = increment;
  this._maxMinutes = maxMinutes;
  this._entryPoints = entryPoints;
};

util.inherits(AllTransferPatternsCalculator, stream.Transform);

AllTransferPatternsCalculator.prototype._write = function (clusteringResult, encoding, done) {
  // 1. We will now generate optimal paths w.r.t. the earliest arrival time for
  //    every possible departure time and every stop in the network. We create a
  //    new stream of connections for every departure time, and then we run CSA
  //    in parallel on this stream to build an MST for each stop.

  this._clusteringResult = clusteringResult;
  var currentDate = this._startDate;
  var minutesArray = [];
  for (var i = 0; i <= this._maxMinutes; i += this._increment) {
    minutesArray.push(i);
  }

  this._borderStations = clusteringResult.borderStations;

  // 2. Every MST will be further processed by a TransferPatternGraphBuilder.
  //    There is one such builder for every cluster. The root of the MST
  //    determines which builder will be used.
  // 3. Each such builder produces a graph of transfer patterns for the
  //    corresponding cluster. These graphs are then aggregated in one
  //    large associative array with the clusters as keys. This will be done
  //    by TransferPatternGraphAggregator.
  this._dagBuilders = {};
  this._dagBuilderPromises = [];
  var self = this;

  // The aggregated result will be the output of the current stream as well.
  var aggregator = new TransferPatternGraphAggregator(clusteringResult.inverseClustering).on('data', function (chunk) {
    self.push(chunk);
    done();
  });

  // Create all builders
  for (var cluster in this._clusteringResult.clustering) {
    if (this._clusteringResult.existingClusters[cluster]) {
      this._dagBuilders[cluster] = new TransferPatternGraphBuilder(cluster, clusteringResult.inverseClustering);
      // We will manually end the aggregator stream.
      this._dagBuilders[cluster].pipe(aggregator, {end: false});
      var self = this;

      // Use deferred promises to know when each builder is done processing transfer patterns.
      // When everything is done, we may end the aggregator stream.
      (function () {
        var deferred = Q.defer();
        self._dagBuilderPromises.push(deferred.promise);
        self._dagBuilders[cluster].on('finish', function () {
          deferred.resolve();
        });
        self._dagBuilders[cluster].on('error', function (err) {
          deferred.reject(err);
        });
      }());
    }
  }

  this._promises = [];
  this._deferredObjs = {};

  // Create deferred promises for every departure time.
  minutesArray.forEach(function (minutes) {
    var deferred = Q.defer();
    self._deferredObjs[minutes] = deferred;
    self._promises.push(deferred.promise);
  });

  // For every departure time (not in parallel but in series):
  async.eachSeries(minutesArray,
            function (minutes, seriesCallback) {
               // This array will hold exactly one function for each departure
               // stop. These "tasks" will then be run in parallel using async.
               var tasks = [];

               // Build a fetcher and a streamer for this departure time.
               var dep = new Date(currentDate.getTime() + minutes*60000);
               var fetcher = new Fetcher(self._entryPoints);
               var deferred = self._deferredObjs[minutes];
               var streamer = fetcher.buildConnectionsStream({"departureTime": dep},
                function (connectionsStream) {
                  tasks.push.apply(tasks,
                    _und.map(self._clusteringResult.inverseClustering, // for every stop
                             function (stop, cluster) {
                               return function (callback) {
                                 // Launch a CSA query for the current stop and the current departure time
                                 var query = {"departureStop" : stop,
                                              "departureTime": currentDate
                                             };
                                 var planner = new Planner(query);

                                 planner.on('error', function (error) {
                                   console.error('planner error: ' + error);
                                   deferred.reject();
                                 });

                                 var localPathBuilder
                                   = new TransferPatternBuilder(stop,
                                                          self._clusteringResult.inverseClustering,
                                                          self._borderStations);
                                 // Pipe to TransferPatternBuilder to build *paths*.
                                 var resultStream = connectionsStream.pipe(planner)
                                                                     .pipe(localPathBuilder);

                                 // The current task is ready when all paths have been generated.
                                 resultStream.on('finish', () => { callback(); });

                                 // Pipe to DAGBuilder to build a DAG out of these paths
                                 var dagStream = resultStream.pipe(self._dagBuilders[self._clusteringResult.inverseClustering[stop]],
                                                                   { end: false });
                               };
                             }));

                   // Now run everything in parallel for the current departure time.
                   async.parallel(tasks, function (err) {
                     console.log('finished building transfer patterns for departure time ' + dep);
                     deferred.resolve();
                     seriesCallback();
                   });
                   streamer.on('error', function (err) {
                     console.error('error httpconnectionstream: ' + err);
                     deferred.reject();
                   });
                });
             }
            );

  // When every TransferPatternGraphBuilder is ready, end the TransferPatternGraphAggregator.
  Q.all(this._dagBuilderPromises).then(function () {
    aggregator.end();
  }, function (err) {
    console.log('error occurend', err);
  });

  // When all departure times have been processed, end every TransferPatternGraphBuilder stream.
  Q.all(this._promises).then(function () {
    console.log('finished building all transfer patterns');
    for (var cluster in self._dagBuilders) {
      self._dagBuilders[cluster].end();
    }
  });
};

module.exports = AllTransferPatternsCalculator;
