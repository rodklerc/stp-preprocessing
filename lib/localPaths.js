var async = require('async'),
    DAGAggregator = require('./dagAggregator.js'),
    DAGBuilder = require('./dagBuilder.js'),
    Fetcher = require('lc-client').Fetcher,
    LocalPathBuilder = require('./localPathBuilder.js'),
    Planner = require('csa').BasicCSA,
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

// Helper function to determine which stations are border stations.
// A border station is a station with connections from or to a station in
// another cluster.
CalculateLocalPaths.prototype._determineBorderStations = function() {
  // TODO optimize
  this._borderStations = {};
  for (var stop in this._clusteringResult.graph) {
    this._borderStations[stop] = false;
  }
  for (var stop in this._clusteringResult.graph) {
    for (var stop2 in this._clusteringResult.graph[stop]) {
      if (this._clusteringResult.inverseClustering[stop] !=
          this._clusteringResult.inverseClustering[stop2]) {
            this._borderStations[stop] = true;
            this._borderStations[stop2] = true;
      }
    }
  }
}

CalculateLocalPaths.prototype._write = function (clusteringResult, encoding, done) {
  // 1. We will now generate optimal paths w.r.t. the earliest arrival time for
  //    every possible departure time and every stop in the network. We create a
  //    new stream of connections for every departure time, and then we run CSA
  //    in parallel on this stream to build an MST for each stop.

  this._clusteringResult = clusteringResult;
  var currentDate = this._startDate;
  var minutesArray = [0, 1]; // TODO expand to all possible departure times
  // We will need to know the border stations
  this._determineBorderStations();

  // 2. Every MST will be further processed by a DAGBuilder. There is one
  //    DAGBuilder for every cluster. The root of the MST determines which
  //    DAGBuilder will be used.
  // 3. Each DAGBuilder produces a directed acyclic graph of transfer patterns
  //    for the corresponding cluster. These DAGs are then aggregated in one
  //    large associative array with the clusters as keys. This will be done
  //    by DAGAggregator.
  this._dagBuilders = {};
  var aggregator = new DAGAggregator();
  aggregator.on('finish', function () {
    console.log('constructed all transfer patterns for given time range'); done();
  });
  aggregator.on('data', function (data) {
    // write result
    this.push({dags: data.dags, convexity: data.convexity,
               borderStations: this._borderStations});
  });
  for (var cluster in this._clusteringResult.clustering) {
    this._dagBuilders[cluster] = new DAGBuilder(cluster, clusteringResult.inverseClustering);
    this._dagBuilders[cluster].pipe(aggregator);
  }

  var self = this;

  minutesArray
    // For each departure time
    .forEach(function (minutes) {
               // This array will hold exactly one function for each departure
               // stop. These "tasks" will then be run in parallel using async.
               var tasks = [];

               // Build a fetcher and a streamer for this departure time.
               var dep = new Date(currentDate.getTime() + minutes*60000);
               var fetcher = new Fetcher(self._entryPoints);
               var streamer = fetcher.buildConnectionsStream({"departureTime": dep},
                function (connectionsStream) {
                  tasks.push.apply(tasks,
                    _und.map(self._clusteringResult.inverseClustering, // for every stop
                             function (stop, cluster) {
                               return function (callback) {
                                 console.log('launch CSA for departure ' + currentDate + ' and stop ' + stop);

                                 // Launch a CSA query for the current stop and the current departure time
                                 var query = {"departureStop" : stop,
                                              "departureTime": currentDate
                                             };
                                 var planner = new Planner(query);

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
                                 var dagStream = resultStream.pipe(self._dagBuilders[self._clusteringResult.inverseClustering[stop]]);
                               };
                             }));

                   // Now run everything in parallel for the current departure time.
                   async.parallel(tasks, function (err) {
                     console.log('finished building transfer patterns for departure time ' + dep);
                   });
                });
             }
            );
};

module.exports = CalculateLocalPaths;
