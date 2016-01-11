var stream = require('stream');
var util = require('util');
var Client = require('lc-client');
var async = require('async');
var Fetcher = require('lc-client').Fetcher;
var Planner = require('csa').BasicCSA;
var LocalPathBuilder = require('./localPathBuilder.js');
var _und = require("underscore");
var DAGBuilder = require('./dagBuilder.js');

// The following line is necessary because otherwise a memory leak warning
// will be issued.
// See for example "Concurrent Handlers" on
// http://www.jongleberry.com/understanding-possible-eventemitter-leaks.html.
require('events').EventEmitter.defaultMaxListeners = Infinity;

/**
 * Transforms a clustering into an array of optimal paths w.r.t. the earliest
 * arrival time. Paths are grouped per cluster.
 * A path can be seen as a path in the transfer pattern graph.
 * We currently use CSA.
 * @param startDate Scan 24 hours starting from this time and date
 * @param entryPoints configuration for the linked connections data
 */
var CalculateLocalPaths = function (startDate, entryPoints) {
  stream.Transform.call(this, {objectMode : true});
  this._startDate = startDate;
  this._entryPoints = entryPoints;
};

util.inherits(CalculateLocalPaths, stream.Transform);

CalculateLocalPaths.prototype._write = function (clusteringResult, encoding, done) {
  this._clusteringResult = clusteringResult;

  var currentDate = this._startDate;
  this._tasks = [];

  var minutesArray = [0]; // TODO expand to all possible departure times

  // Determine all border stations
  this._borderStations = {};
  for (var stop in this._clusteringResult.graph) {
    this._borderStations[stop] = false;
  }
  for (var stop in this._clusteringResult.graph) {
    if (this._clusteringResult.inverseClustering[stop] !=
        this._clusteringResult.inverseClustering[this._clusteringResult.graph[stop]]) {
      this._borderStations[stop] = true;
      this._borderStations[this._clusteringResult.graph[stop]] = true;
    }
  }

  var self = this;

  // --- START DEBUG ---
  /*var newArray = {};
  var counter = 0;
  for (var stop in this._clusteringResult.inverseClustering) {
    newArray[stop] = this._clusteringResult.inverseClustering[stop];
    counter++;
    if (counter >= 1) break;
  }
  this.debugInverseClustering = this._clusteringResult.inverseClustering;
  this._clusteringResult.inverseClustering = newArray;*/
  /// --- END DEBUG ---

  // We will now generate optimal paths w.r.t. the earliest arrival time for
  // every possible departure time and every stop in the network. We create a
  // new stream of connections for every departure time, and then we run CSA
  // in parallel on this stream to build an MST. This MST is further processed
  // by a LocalPathBuilder, which converts this MST into transfer patterns.
  // These transfer patterns are then aggregated in a single DAG, indexed by
  // the arrival stop.
  // We use something slightly more complicated than for-loops, to avoid issues
  // with scoping.
  minutesArray
    // For each departure time
    .forEach(function (minutes) {
               // Build a fetcher and a streamer for this departure time.
               // TODO: is it possible to use exactly one stream with departureTime
               // set to for example "00:00"?
               var tasks = [];
               var dep = new Date(currentDate.getTime() + minutes*60000);
               var fetcher = new Fetcher(self._entryPoints);
               var streamer = fetcher.buildConnectionsStream({"departureTime": dep},
                function (connectionsStream) {
                  // We aggregate all CSA runs for the current departure time in
                  // an array which will then be processed asynchronously.
                  tasks.push.apply(tasks,
                    _und.map(self._clusteringResult.inverseClustering,
                             function (stop, cluster) {
                               return function (callback) {
                                 console.log('launch CSA for departure ' + currentDate + ' and stop ' + stop);
                                 // Launch CSA for this stop.
                                 var query = {"departureStop" : stop,
                                              "departureTime": currentDate
                                             };
                                 var planner = new Planner(query);

                                 var localPathBuilder
                                   = new LocalPathBuilder(stop,
                                                          /*self.debugInverseClustering*/self._clusteringResult.inverseClustering,
                                                          self._borderStations);
                                 var resultStream = connectionsStream.pipe(planner)
                                                                     .pipe(localPathBuilder)
                                                                     .pipe(new DAGBuilder());
                                 resultStream.on('end', function () { console.log('ended'); callback(); });
                               };
                             }));
                   async.parallel(tasks, function (err) {
                     console.log('finished building transfer patterns for departure time ' + dep);
                   });
                });
             }
            );
};

CalculateLocalPaths.prototype._flush = function (callback) {
  callback();
};

module.exports = CalculateLocalPaths;
