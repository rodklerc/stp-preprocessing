var stream = require('stream'),
    util = require('util');

/**
  * The input of a DAGBuilder is a set of transfer patterns.
  * These paths are merged into a graph. Actually, there are multiple DAG's to
  * avoid cycles. TODO: explain this construction in more detail
  * As a "by-product", we also determine if this cluster is convex or not.
  * The output is an object with two values:
  * cluster: the cluster used to construct this dag
  * convex: wether this cluster is convex or not
  * dag: the dag
  */
var DAGBuilder = function (cluster, inverseClustering) {
  stream.Transform.call(this, {objectMode : true});
  this._dag = {};
  this._cluster = cluster;
  this._inverseClustering = inverseClustering;
  this._isConvex = true;
  this._counter = 0;
  this._stopsUsed = {};
  this._nrOfEdges = 0;
};

util.inherits(DAGBuilder, stream.Transform);

// Helper function to check and update convexity of this cluster.
DAGBuilder.prototype._checkConvexity = function (tp) {
  if (this._isConvex) {
    // There is an optimal path between two stops in the same cluster that
    // traverses another cluster. This means the current cluster is not
    // convex.
    if (tp.changedCluster &&
        this._inverseClustering[tp.tp[0]] == this._inverseClustering[tp.stop]) {
        console.log('cluster ' + this._cluster + ' is not convex!');
        this._isConvex = false;
    }
  }
}

// Process one transfer pattern
DAGBuilder.prototype._write = function (tp, encoding, done) {
  var path = tp.tp;

  this._checkConvexity(tp);

  for (var i = 0; i < path.length - 1; i++) {
    if (this._dag[path[i]] === undefined) {
      this._dag[path[i]] = [];
    }
    if (this._dag[path[i]].indexOf(path[i+1]) <= -1) {
      this._dag[path[i]].push(path[i+1]);
      if (this._dag[path[i]].length > 1) {
        console.log('<<<< OK >>>>');
      }
      this._nrOfEdges++;
    }
  }

  done();
};

DAGBuilder.prototype._flush = function (callback) {
  this.push({cluster: this._cluster, convex: this._isConvex, dag: this._dag});
  console.log('cluster ' + this._cluster + ', number of edges: ' + this._nrOfEdges);
  callback();
};

module.exports = DAGBuilder;
