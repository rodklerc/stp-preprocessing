var stream = require('stream'),
    util = require('util');

/**
  * The input of a DAGBuilder is a set of transfer patterns.
  * These paths are merged into a DAG. Actually, there are multiple DAG's to
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
};

util.inherits(DAGBuilder, stream.Transform);

// Helper function to determine if an edge between startNode and endNode
// already exists in the DAG.
DAGBuilder.prototype._edgeExists = function (startNode, endNode) {
  if (this._dag[startNode] === undefined) return false;
  if (this._dag[startNode][endNode] === undefined) return false;
  return true;
}

// Helper function to check and update convexity of this cluster.
DAGBuilder.prototype._checkConvexity = function (tp) {
  if (this._isConvex) {
    // We will now loop over the path to check if we moved to another cluster.
    // We will use this to determine if a cluster is convex or not.
    // There is an optimal path between two stops in the same cluster that
    // traverses another cluster. This means the current cluster is not
    // convex.
    if (tp.changedCluster &&
        this._inverseClustering[tp.tp[0]] === this._inverseClustering[this._stop]) {
        console.log('cluster ' + this._inverseClustering[this._stop] + ' is not convex!');
        this._isConvex = false;
    }
  }
}

// Helper function to determine if adding a transfer pattern would result in
// a cycle.
DAGBuilder.prototype._checkCycles = function (tp) {
  // Check if adding this path would result in a cycle.
  // TODO instead of checking each time, we could also store all paths processed
  var path = tp.tp;
  var i = path.length - 1;
  while (i > 0) {
    if (this._dag[path[i]] != undefined) {
      if (!this._edgeExists(path[i], path[i+1])) {
        return false;
      }
    } else {
      return false;
    }
    i--;
  }
  return true;
}

// Process one transfer pattern
DAGBuilder.prototype._write = function (tp, encoding, done) {
  var path = tp.tp;

  this._checkConvexity(tp);
  var cycleFound = this._checkCycles(tp);

  for (var i = 0; i < path.length - 1; i++) {
    if (this._dag[path[i]] === undefined) {
      this._dag[path[i]] = {};
    }

    if (this._edgeExists(path[i], path[i+1])) {
      // If adding this pattern results in a cycle, but an edge of this pattern
      // already exists, then we label this existing edge with the starting
      // point of the path (MST root).
      if (cycleFound) {
        this._dag[path[i]][path[i+1]].push(tp.stop);
      }
    } else {
      if (cycleFound) {
        // Add a new edge but label it
        this._dag[path[i]][path[i+1]] = [tp.stop];
      } else {
        // Add a new edge without any labels
        this._dag[path[i]][path[i+1]] = [];
      }
    }
  }
  this._counter++;
  done();
};

DAGBuilder.prototype._flush = function (callback) {
  console.log('flush builder ' + this._cluster + ', ' + this._counter + 'tps received');
  this.push({cluster: this._cluster, convex: this._isConvex, dag: this._dag});
  callback();
};

module.exports = DAGBuilder;
