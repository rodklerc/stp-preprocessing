var stream = require('stream');
var util = require('util');

// TODO use database instead of working memory (the graph could be huge if the
// transport network considered is large)

/**
 * A GraphBuilder is a duplex stream. The input should be a stream of
 * connections. The output of this stream is the adjacency list representation
 * of a weighted graph where there is one node for every station encountered as a
 * departureStop or arrivalStop of a connection. An edge (u,v) exists if and
 * only if a connection between stop u and stop v was encountered. The weight
 * of an edge equals the number of connections between u and v. This construction
 * is similar to the construction described in the scalable transfer patterns
 * paper, with the exception that footpaths are not taken into account.
 */
var GraphBuilder = function (db) {
  stream.Transform.call(this, {objectMode : true});
  this._db = db;
  this._mapping = {};
  this._counter = 0;
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

GraphBuilder.prototype._write = function (connection, encoding, done) {
  if (connection === null) done();
  // Note that we do not call updateMapping two times, since we construction
  // a *directed* graph.
  this._updateMapping(connection.departureStop, connection.arrivalStop);
  //this._updateMapping(connection.arrivalStop, connection.departureStop);
  this._counter++;
  console.log('processing connection ' + this._counter + ', departure time ' + connection.departureTime);
  done();
}

GraphBuilder.prototype._flush = function (done) {
  this.push(this._mapping);
  console.log('building graph finished');
  console.log(this._mapping);
  done();
}

module.exports = GraphBuilder;
