var stream = require('stream'),
    util = require('util');

/**
 * A GraphBuilder is a duplex stream. The input should be a stream of
 * connections. The output of this stream is an object with the following items:
 * graph: the adjacency list representation of a weighted graph where there
 * is one node for every station encountered as a departureStop or arrivalStop
 * of a connection. An edge (u,v) exists if and only if a connection between
 * stop u and stop v was encountered. The weight of an edge equals the number
 * of connections between u and v. This construction is similar to the
 * construction described in the scalable transfer patterns paper, with the
 * exception that footpaths are not taken into account.
 * tripToStations: mapping of trip ids to a list of stations on this trip,
 * in no particular order.
 */
var GraphBuilder = function () {
  stream.Transform.call(this, {objectMode : true});
  this._mapping = {};
  this._counter = 0;

  // Maps trip ids to the stops for this trip
  this._tripToStations = {};
};

util.inherits(GraphBuilder, stream.Transform);

GraphBuilder.prototype._updateMapping = function(stop1, stop2) {
  if (this._mapping[stop1] === undefined) {
    this._mapping[stop1] = {};
  }
  if (this._mapping[stop1][stop2] === undefined) {
    this._mapping[stop1][stop2] = 1;
  } else {
    this._mapping[stop1][stop2] += 1;
  }
}

GraphBuilder.prototype._updateStationTripMapping = function (station, trip) {
  if (this._tripToStations[trip] === undefined) {
    this._tripToStations[trip] = [station];
  } else {
    if (this._tripToStations[trip].indexOf(station) <= -1) {
      this._tripToStations[trip].push(station);
    }
  }
}

GraphBuilder.prototype._write = function (connection, encoding, done) {
  if (connection === null) done();
  // Note that we do not call updateMapping two times, since we construction
  // a *directed* graph.
  this._updateMapping(connection.departureStop, connection.arrivalStop);
  this._updateStationTripMapping(connection.departureStop, connection["gtfs:trip"]["@id"]);
  this._updateStationTripMapping(connection.arrivalStop, connection["gtfs:trip"]["@id"]);
  this._counter++;
  console.log('processing connection ' + this._counter + ', departure time ' + connection.departureTime);
  done();
}

GraphBuilder.prototype._flush = function (done) {
  this.push({graph: this._mapping,
             tripToStations: this._tripToStations});
  console.log('building graph finished');
  done();
}

module.exports = GraphBuilder;
