var stream = require('stream');
var util = require('util');
var _und = require("underscore");

/**
  * The input of a DAGBuilder is a set of paths. These paths are merged into
  * a DAG.
  */
var DAGBuilder = function (cluster) {
  stream.Transform.call(this, {objectMode : true});
  this._dag = {};
  this._cluster = cluster;
};

util.inherits(DAGBuilder, stream.Transform);

DAGBuilder.prototype._edgeExists = function (startNode, endNode) {
  if (this._dag[startNode] === undefined) return false;
  if (this._dag[startNode][endNode] === undefined) return false;
  return true;
}

DAGBuilder.prototype._write = function (path, encoding, done) {
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
