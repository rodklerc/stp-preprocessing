var async = require('async'),
    DAGAggregator = require('./dagAggregator.js'),
    DAGBuilder = require('./dagBuilder.js'),
    Fetcher = require('lc-client').Fetcher,
    LocalPathBuilder = require('./localPathBuilder.js'),
    Planner = require('csa').BasicCSA,
    Q = require('q'),
    stream = require('stream'),
    util = require('util'),
    _und = require("underscore");

// The following line is necessary because otherwise a memory leak warning
// will be issued.
// See for example "Concurrent Handlers" on
// http://www.jongleberry.com/understanding-possible-eventemitter-leaks.html.
require('events').EventEmitter.defaultMaxListeners = Infinity;

// TODO allow for a more flexible time range
/**
 * Transforms the result of ClusterAlgorithm into a directed acyclic graph of
 * transfer patterns. Everything is calculated in terms of the clustering
 * result written to this stream. The DAGs produced by this stream are grouped
 * per cluster in an associative array.
 * The output of this stream consists of an object with the following values:
 * dags: see "DAGAggregator"
 * convexity: see "DAGAggregator"
 * borderStations: mapping of station id to boolean indicating wether this station
 * is a border station
 * @param startDate Scan 24 hours starting from this time and date. The
 * transfer patterns will only be valid for this 24-hour time range.
 * @param entryPoints Entry points for the linked connections client (See
 * documentation on linked connections.)
 */
var CalculateLocalPaths = function (startDate, entryPoints) {
  stream.Transform.call(this, {objectMode : true});
  this._startDate = startDate;
  this._entryPoints = entryPoints;
};

util.inherits(CalculateLocalPaths, stream.Transform);

CalculateLocalPaths.prototype._write = function (clusteringResult, encoding, done) {
  // 1. We will now generate optimal paths w.r.t. the earliest arrival time for
  //    every possible departure time and every stop in the network. We create a
  //    new stream of connections for every departure time, and then we run CSA
  //    in parallel on this stream to build an MST for each stop.

  this._clusteringResult = clusteringResult;
  var currentDate = this._startDate;
  var minutesArray = [0, 10, 20, 30, 40]; // TODO expand to all possible departure times
  this._borderStations = clusteringResult.borderStations;

  // 2. Every MST will be further processed by a DAGBuilder. There is one
  //    DAGBuilder for every cluster. The root of the MST determines which
  //    DAGBuilder will be used.
  // 3. Each DAGBuilder produces a directed acyclic graph of transfer patterns
  //    for the corresponding cluster. These DAGs are then aggregated in one
  //    large associative array with the clusters as keys. This will be done
  //    by DAGAggregator.
  this._dagBuilders = {};
  this._dagBuilderPromises = [];
  var self = this;
  var aggregator = new DAGAggregator(clusteringResult.inverseClustering).on('data', function (chunk) {
    console.log('writing result');
    self.push(chunk);
    done();
  });

  for (var cluster in this._clusteringResult.clustering) {
    if (this._clusteringResult.existingClusters[cluster]) {
      this._dagBuilders[cluster] = new DAGBuilder(cluster, clusteringResult.inverseClustering);
      this._dagBuilders[cluster].pipe(aggregator, {end: false});
      var self = this;
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

  minutesArray.forEach(function (minutes) {
    var deferred = Q.defer();
    self._deferredObjs[minutes] = deferred;
    self._promises.push(deferred.promise);
  });

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
                                   = new LocalPathBuilder(stop,
                                                          self._clusteringResult.inverseClustering,
                                                          self._borderStations);
                                 // Pipe to LocalPathBuilder to build *paths*.
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

  Q.all(this._dagBuilderPromises).then(function () {
    aggregator.end();
  }, function (err) {
    console.log('error occurend', err);
  });

  Q.all(this._promises).then(function () {
    console.log('finished building all transfer patterns');
    for (var cluster in self._dagBuilders) {
      self._dagBuilders[cluster].end();
    }
  });
};

module.exports = CalculateLocalPaths;
