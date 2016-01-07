var stream = require('stream');
var util = require('util');
var Client = require('lc-client');
var async = require('async');
var Fetcher = require('lc-client').Fetcher;
var Planner = require('csa').BasicCSA;

var LocalPathBuilder = function (stop, inverseClustering) {
  stream.Transform.call(this, {objectMode : true});
  this._allConnections = {};
  this._stop = stop;
  this._inverseClustering = inverseClustering;
};

util.inherits(LocalPathBuilder, stream.Transform);

LocalPathBuilder.prototype._write = function (connection, encoding, done) {
  this._allConnections[connection["@id"]] = connection;
  done();
};

LocalPathBuilder.prototype._flush = function (callback) {
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
  var allConnections = this._allConnections;
  var stop = this._stop;

  for (var c in allConnections) {
    var linkDeparture = allConnections[c].arrivalStop;

    // Do not go outside the departure cluster.
    if (this._inverseClustering[linkDeparture] != this._inverseClustering[stop]) {
      continue;
    }
    var currentConnection = allConnections[c];

    while (true) {

      // Arriving at the departure stop also indicates a transfer
      if (currentConnection.previous == null) {
        mst[linkDeparture] = currentConnection.departureStop;
        break;
      }

      var previousConnection = allConnections[currentConnection.previous];
      var linkArrival = previousConnection.departureStop;

      // Do not go outside the departure cluster.
      if (this._inverseClustering[linkArrival] != this._inverseClustering[stop]) {
        break;
      }

      // To get to this connection, we need to transfer at
      // previousConnection.arrivalStop == currentConnection.departureStop.
      // So this is the transfer station.
      if (currentConnection["gtfs:trip"]["@id"] != previousConnection["gtfs:trip"]["@id"]) {
        console.log(previousConnection.arrivalStop + '*');
        mst[linkDeparture] = previousConnection.arrivalStop;
      } else {
        // If we already know the next transfer stop starting
        // from the current linkArrival, then we may stop
        // looping as well.
        if (mst[linkArrival] != undefined) {
          console.log(linkArrival + '°');
          mst[linkDeparture] = mst[linkArrival];
        } else {
          console.log(linkArrival);
          currentConnection = previousConnection;
        }
      }
    }
  }

  console.log(mst);
  this.push(mst);
  callback();
};

module.exports = LocalPathBuilder;
