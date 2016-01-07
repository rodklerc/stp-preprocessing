var stream = require('stream');
var util = require('util');
var Client = require('lc-client');
var async = require('async');

var CalculateLocalTPs = function (startDate, entryPoints) {
  stream.Transform.call(this, {objectMode : true});
  this._startDate = startDate;
  this._entryPoints = entryPoints;
};

util.inherits(CalculateLocalTPs, stream.Transform);

CalculateLocalTPs.prototype._write = function (clusteringResult, encoding, done) {
  this._clusteringResult = clusteringResult;

  // We will now calculate the optimal routes w.r.t. the earliest arrival time
  // on a per-cluster basis. We do this by launching a query for every ordered
  // pair of stops in the same cluster, and this is repeated for every possible
  // departure time in a (TODO: given) time range.
  // Note that this approach is *VERY* inefficient. The number of queries for
  // a 24-hour period on a clustering of the NMBS data with U=100 is 1.161.200.
  // Note that the efficiency can be vastly improved once profile queries are
  // implemented.

  // NOTE: assuming 2 seconds per query and no parallelism, this calculation will
  // take approximately 26 days for the NMBS data.

  // TODO: possible improvements *without* profile queries:
  // 1. run some queries in parallel
  // 2. the number of departure times may be reduced if the earliest departure
  //    time for each journey is known, and if the minimal frequency is known.
  //    For example: A->B journey departs as early as 04:00, there is one
  //    journey every hour, so only departure times 04:00, 05:00, etc. need to
  //    be checked.

  var planner = new Client(this._entryPoints);
  var currentDate = new Date(this._startDate);
  var self = this;

  // This array will hold the queries to be executed. We first construct all
  // query tasks and we subsequently use async to run them.
  var queries = [];

  // This *hash table* will hold all the *unique* paths found.
  // TODO check if equality of paths is indeed what we expect it to be
  this._paths = {};

  // For every possible departure time
  for (var minutes = 0; minutes <= 1; minutes++) {
      // For every cluster
      for (var c in this._clusteringResult.clustering) {
        // For every ordered pair of stops in the cluster
        for (var s1 in this._clusteringResult.clustering[c]) {
          for (var s2 in this._clusteringResult.clustering[c]) {
            var stop1 = this._clusteringResult.clustering[c][s1];
            var stop2 = this._clusteringResult.clustering[c][s2];
            if (s1 != s2) {
              var query = {"arrivalStop" : stop2,
                           "departureStop" : stop1,
                           "departureTime": currentDate
                          };
              if (queries.length <= 4) { // TODO debug
                queries.push(function(callback) {
                  planner.query(query, function (resultStream, source) {
                    resultStream.on('result', function (path) {
                      if (paths[path] === undefined) {
                        paths[path] = {};
                      }
                      console.log(path);
                      console.log('-------------');
                      callback();
                    });

                    // TODO only works when the following line is present, why?
                    resultStream.on('data', function (connection) { });
                  });
                });
              }
            }
          }
        }
      }
      currentDate.setMinutes(currentDate.getMinutes() + 1);
  }

  async.series(queries, function (err) { done(); });
};

CalculateLocalTPs.prototype._flush = function (callback) {
  // We will now process all paths in order to build a transfer pattern DAG
  // for each cluster.

  callback();
};

module.exports = CalculateLocalTPs;
