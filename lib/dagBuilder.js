var stream = require('stream');
var util = require('util');
var _und = require("underscore");

/**
  * The input of a DAGBuilder is a set of paths. These paths are merged into
  * a DAG. As a "by-product", we also determine if this cluster is convex
  * or not.
  */
var DAGBuilder = function (cluster, inverseClustering) {
  stream.Transform.call(this, {objectMode : true});
  this._dag = {};
  this._cluster = cluster;
  this._inverseClustering = inverseClustering;
  this._isConvex = true;
};

util.inherits(DAGBuilder, stream.Transform);

DAGBuilder.prototype._edgeExists = function (startNode, endNode) {
  if (this._dag[startNode] === undefined) return false;
  if (this._dag[startNode][endNode] === undefined) return false;
  return true;
}

DAGBuilder.prototype._write = function (tp, encoding, done) {
  var path = tp.tp;

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

  // Check if adding this path would result in a cycle.
  // TODO instead of checking each time, we could also store all paths processed
  var cycleFound = true;
  var i = path.length - 1;
  while (cycleFound && i > 0) {
    if (this._dag[path[i]] != undefined) {
      if (!this._edgeExists(path[i], path[i+1])) {
        cycleFound = false;
      }
    } else {
      cycleFound = false;
    }
    i--;
  }

  for (var i = 0; i < path.length - 1; i++) {
    if (this._dag[path[i]] === undefined) {
      this._dag[path[i]] = {};
    }

    if (this._edgeExists(path[i], path[i+1])) {
      if (cycleFound) {
        this._dag[path[i]][path[i+1]].push(path[path.length - 1]);
      }
    } else {
      if (cycleFound) {
        this._dag[path[i]][path[i+1]] = [path[path.length - 1]];
      } else {
        this._dag[path[i]][path[i+1]] = [];
      }
    }
  }
  done();
};

DAGBuilder.prototype._flush = function (callback) {
  this.push({cluster: this._cluster, dag: this._dag});
  callback();
};

module.exports = DAGBuilder;
