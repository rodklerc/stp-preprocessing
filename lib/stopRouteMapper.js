var stream = require('stream'),
    util = require('util');

var StopRouteMapper = function () {
  stream.Transform.call(this, {objectMode : true});
  this._routeToStops = {};
  };

util.inherits(StopRouteMapper, stream.Transform);

StopRouteMapper.prototype._addStopToRoute = function (routeId, stop) {
  if (this._routeToStops[routeId].indexOf(stop) <= -1) {
    this._routeToStops[routeId].push(stop);
  }
}

// Since connections are ordered by departure time, stops for the same route
// will be ordered as well.
StopRouteMapper.prototype._write = function (connection, encoding, done) {
  var routeId = connection["gtfs:route"]["@id"];
  if (this._routeToStops[routeId] === undefined) {
    this._routeToStops[routeId] = [];
  }
  this._addStopToRoute(routeId, connection.departureStop);
  this._addStopToRoute(routeId, connection.arrivalStop);
  done();
};

StopRouteMapper.prototype._flush = function (callback) {
  var stopsToRoutes = {};
  for (var routeId in this._routeToStops) {
    for (var i = 0; i < this._routeToStops[routeId].length; i++) {
      // stops are *ordered* per route, so the loop may start from i+1
      for (var j = i+1; j < this._routeToStops[routeId].length; j++) {
        var s1 = this._routeToStops[routeId][i];
        var s2 = this._routeToStops[routeId][j];
        if (stopsToRoutes[s1] === undefined) {
          stopsToRoutes[s1] = {};
        }
        if (stopsToRoutes[s1][s2] === undefined) {
          stopsToRoutes[s1][s2] = [];
        }
        if (stopsToRoutes[s1][s2].indexOf(routeId) <= -1) {
          stopsToRoutes[s1][s2].push(routeId);
        }
      }
    }
  }
  this.push(stopsToRoutes);
  callback();
};

module.exports = StopRouteMapper;
