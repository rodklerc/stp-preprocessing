var stream = require('stream'),
    util = require('util');


// TODO: space consumption can be reduced if a smarter edge labeling strategy is implemented,
// *worst case* space consumption is now O(n³) with n the number of stops.

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
  this._stopsUsed = {};
};

util.inherits(DAGBuilder, stream.Transform);

// Helper function to determine if an edge between startNode and endNode
// already exists in the DAG.
DAGBuilder.prototype._edgeExists = function (startNode, endNode) {
  if (this._dag[startNode] === undefined) {
    return false;
  }
  if (this._dag[startNode][endNode] === undefined) {
    return false;
  }
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

// Uses an iterative implementation of depth-first search to check wether a
// path between stop1 and stop2 exists.
// TODO cache results to save processing time
DAGBuilder.prototype._pathExists = function(stop1, stop2) {
  var stack = [stop1];
  var discovered = {};

  while (stack.length > 0) {
    var node = stack.pop();
    if (node == stop2) {
      return true;
    }
    if (discovered[node] === undefined) {
      discovered[node] = true;
      if (this._dag[node] != undefined) {
        for (var neighbour in this._dag[node]) {
          stack.push(neighbour);
        }
      }
    }
  }

  return false;
}

// Process one transfer pattern
DAGBuilder.prototype._write = function (tp, encoding, done) {
  var path = tp.tp;
  this._stopsUsed[tp.stop] = true;

  this._checkConvexity(tp);

  for (var i = 0; i < path.length - 1; i++) {
    var cycleFound = this._pathExists(path[i+1], path[i]);
    if (this._edgeExists(path[i], path[i+1])) {
      if (cycleFound) {
        if (this._dag[path[i]][path[i+1]].length != 0) {
          if (this._dag[path[i]][path[i+1]].indexOf(tp.stop) <= -1) {
            this._dag[path[i]][path[i+1]].push(tp.stop);
          }
        }
      }
    } else {
      if (this._dag[path[i]] === undefined) {
        this._dag[path[i]] = {};
      }
      if (cycleFound) {
        this._dag[path[i]][path[i+1]] = [tp.stop];
      } else {
        this._dag[path[i]][path[i+1]] = [];
      }
    }
  }

  this._counter++;
  done();
};

DAGBuilder.prototype._flush = function (callback) {
  //console.log('flush builder ' + this._cluster + ', ' + this._counter + 'tps received');
  this.push({cluster: this._cluster, convex: this._isConvex, dag: this._dag});
  callback();
};

module.exports = DAGBuilder;
