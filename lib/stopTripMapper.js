var stream = require('stream'),
    util = require('util');

var StopTripMapper = function () {
  stream.Transform.call(this, {objectMode : true});
  this._tripToStops = {};
};

util.inherits(StopTripMapper, stream.Transform);

StopTripMapper.prototype._addStopToTrip = function (tripId, stop) {
  if (this._tripToStops[tripId].indexOf(stop) <= -1) {
    this._tripToStops[tripId].push(stop);
  }
}

// Since connections are ordered by departure time, stops for the same trip
// will be ordered as well.
StopTripMapper.prototype._write = function (connection, encoding, done) {
  var tripId = connection["gtfs:trip"]["@id"];
  if (this._tripToStops[tripId] === undefined) {
    this._tripToStops[tripId] = [];
  }
  this._addStopToTrip(tripId, connection.departureStop);
  this._addStopToTrip(tripId, connection.arrivalStop);
  done();
};

StopTripMapper.prototype._flush = function (callback) {
  var stopsToTrips = {};
  for (var tripId in this._tripToStops) {
    for (var i = 0; i < this._tripToStops[tripId].length; i++) {
      // stops are *ordered* per trip, so the loop may start from i+1
      for (var j = i+1; j < this._tripToStops[tripId].length; j++) {
        var s1 = this._tripToStops[tripId][i];
        var s2 = this._tripToStops[tripId][j];
        if (stopsToTrips[s1] === undefined) {
          stopsToTrips[s1] = {};
        }
        if (stopsToTrips[s1][s2] === undefined) {
          stopsToTrips[s1][s2] = [];
        }
        if (stopsToTrips[s1][s2].indexOf(tripId) <= -1) {
          stopsToTrips[s1][s2].push(tripId);
        }
      }
    }
  }
  this.push(stopsToTrips);
  callback();
};

module.exports = StopTripMapper;
