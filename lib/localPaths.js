var stream = require('stream');
var util = require('util');
var Client = require('lc-client');
var async = require('async');
var Fetcher = require('lc-client').Fetcher;
var Planner = require('csa').BasicCSA;
var LocalPathBuilder = require('./localPathBuilder.js');

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

  var fetcher = new Fetcher(this._entryPoints);
  var tasks = [];
  var currentDate = this._startDate;
  var self = this;

  // We will now calculate the minimal spanning tree for each stop and for each
  // possible arrival time.
  for (var minutes = 0; minutes <= 1; minutes++) {
    for (var stop in this._clusteringResult.inverseClustering) {
      var query = {"departureStop" : stop,
                   "departureTime": currentDate
                  };
      tasks.push(function (callback) {
        fetcher.buildConnectionsStream(query, function (connectionsStream) {
          var planner = new Planner(query);
          var localPathBuilder = new LocalPathBuilder(stop, self._clusteringResult.inverseClustering);
          var resultStream = connectionsStream
                              .pipe(planner)
                              .pipe(localPathBuilder)
                              .on('end', function () { console.log('task for stop ' + stop + ' finished'); callback(); } );
        });
      });
    }
    currentDate.setMinutes(currentDate.getMinutes() + 1);
  }

  async.series(tasks, function (err) {
    console.log('all tasks finished');
    done();
  });
};

CalculateLocalPaths.prototype._flush = function (callback) {
  callback();
};

module.exports = CalculateLocalPaths;
