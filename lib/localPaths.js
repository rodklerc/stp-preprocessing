var stream = require('stream');
var util = require('util');
var Client = require('lc-client');
var async = require('async');
var Fetcher = require('lc-client').Fetcher;
var Planner = require('csa').BasicCSA;

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
                   // TODO when running in parallel we will store multiple
                   // connection array's, do we have enough memory to do that?
                   var allConnections = {};

                   fetcher.buildConnectionsStream(query, function (connectionsStream) {
                     var planner = new Planner(query);
                     var resultStream = connectionsStream.pipe(planner);

                     resultStream.on('data', function (connection) {
                       allConnections[connection["@id"]] = connection;
                     });

                     resultStream.on('result', function (path) {
                       // We now transform the array of connections to a transfer
                       // pattern representation.
                       // We loop over all connections, for every connection
                       // we follow the chain of "previous" pointers as long
                       // as the trip remains the same (e.g. there has not been
                       // any transfer). When the first transfer occurs, we
                       // map the initial departure stop to the first transfer
                       // stop. We also stop iterating whenever we get to a stop
                       // outside of the current cluster.
                       // We make use of the fact that one stop can never occur
                       // multiple times as the arrival stop of a MST connection.
                       // TODO verify that this is really true.
                       var mst = {};
                       console.log('processing result');
                       for (var c in allConnections) {
                         console.log('connection ' + c["@id"]);
                         var linkDeparture = allConnections[c].arrivalStop;

                         // Do not go outside the departure cluster.
                         if (this._inverseClustering[linkArrival] != this._inverseClustering[stop]) {
                           continue;
                         }

                         var currentConnection = c;
                         while (true) {
                           var previousConnection = allConnections[allConnections[currentConnection].previous];
                           var linkArrival = previousConnection.departureStop;

                           // Do not go outside the departure cluster.
                           if (this._inverseClustering[linkArrival] != this._inverseClustering[stop]) {
                             break;
                           }

                           // To get to this connection, we need to transfer at
                           // previousConnection.arrivalStop == currentConnection.departureStop.
                           // So this is the transfer station.
                           if (currentConnection["gtfs:trip"]["@id"] != previousConnection["gtfs:trip"]["@id"]) {
                             mst[linkDeparture] = previousConnection.arrivalStop;
                           } else {
                             // If we already know the next transfer stop starting
                             // from the current linkArrival, then we may stop
                             // looping as well.
                             if (mst[linkArrival] != undefined) {
                               mst[linkDeparture] = mst[linkArrival];
                             } else {
                               currentConnection = previousConnection;
                             }
                           }
                         }
                       }
                       console.log(mst);
                       callback();
                     });
                   });
                 });
    }
    currentDate.setMinutes(currentDate.getMinutes() + 1);
  }

  async.series(tasks, function (err) {
    done();
  });
};

CalculateLocalPaths.prototype._flush = function (callback) {
  callback();
};

module.exports = CalculateLocalPaths;
