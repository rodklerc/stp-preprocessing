var stream = require('stream'),
    util = require('util');

/**
  * The input of a TransferPatternGraphBuilder consists of transfer patterns as
  * produced by an instance of TransferPatternBuilder. A TransferPatternGraphBuilder
  * is associated with a certain cluster. In other words, there should be one
  * TransferPatternGraphBuilder for every cluster, and the input transfer patterns
  * of a TransferPatternGraphBuilder should be relevant for the associated cluster.
  * The paths represented by the input transfer patterns are aggregated in one
  * directed graph. There may be (many) more directed paths in this graph than
  * there were transfer patterns, but it is guaranteed that every input transfer
  * pattern will correspond to a path in this graph. Note that this graph will
  * not necessarily be acyclic, so care should be taken when further processing
  * this graph in order to avoid infinite loops.
  * As a "by-product", we also determine if this cluster is convex or not.
  * There will be one output object consisting of the following keys:
  * cluster: the associated cluster
  * convex: wether this cluster is convex or not
  * graph: adjacency list representation of the transfer pattern graph
  * @param cluster The associated cluster
  * @param inverseClustering Mapping of stop id to cluster id, representing a valid clustering.
  */
var TransferPatternGraphBuilder = function (cluster, inverseClustering) {
  stream.Transform.call(this, {objectMode : true});
  this._cluster = cluster;
  this._inverseClustering = inverseClustering;
  this._graph = {};
  this._isConvex = true;
  this._nrOfEdges = 0;
};

util.inherits(TransferPatternGraphBuilder, stream.Transform);

// Helper function to check and update convexity of this cluster.
TransferPatternGraphBuilder.prototype._checkConvexity = function (tp) {
  if (this._isConvex) {
    // There is an optimal path between two stops in the same cluster that
    // traverses another cluster. This means the current cluster is not
    // convex. (Note that tp.tp[0] always represents an arrival station for a
    // route departing from tp.stop. The last part of this route including tp.stop
    // may however not occur in tp.tp if this partial route has already been
    // processed. changedCluster applies to the *whole* path to tp.stop.)
    if (tp.changedCluster &&
        this._inverseClustering[tp.tp[0]] == this._inverseClustering[tp.stop]) {
        console.log('cluster ' + this._cluster + ' is not convex!');
        this._isConvex = false;
    }
  }
}

// Process one transfer pattern
TransferPatternGraphBuilder.prototype._write = function (tp, encoding, done) {
  var path = tp.tp;

  this._checkConvexity(tp);

  // For every edge on the transfer pattern path
  for (var i = 0; i < path.length - 1; i++) {
    if (this._graph[path[i]] === undefined) {
      this._graph[path[i]] = [];
    }
    // Add the edge if it doesn't exist yet
    if (this._graph[path[i]].indexOf(path[i+1]) <= -1) {
      this._graph[path[i]].push(path[i+1]);
      this._nrOfEdges++;
    }
  }

  done();
};

TransferPatternGraphBuilder.prototype._flush = function (callback) {
  this.push({cluster: this._cluster, convex: this._isConvex, graph: this._graph});
  console.log('cluster ' + this._cluster + ', number of edges: ' + this._nrOfEdges);
  callback();
};

module.exports = TransferPatternGraphBuilder;
