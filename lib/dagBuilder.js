var stream = require('stream');
var util = require('util');

/**
  * Transforms a set of paths to a DAG so that performing a DFS starting at
  * each node of the DAG results in exactly these paths.
  * The DAGBuilder can be used to "compress" a set of transfer patterns.
  */
var DAGBuilder = function () {
  stream.Transform.call(this, {objectMode : true});
  this._dag = {};
};

util.inherits(DAGBuilder, stream.Transform);

DAGBuilder.prototype._write = function (path, encoding, done) {
  for (var i = 0; i < path.length; i++) {
    // Stop not encountered before.
    if (this._dag[path[i]] === undefined) {
      this._dag[path[i]] = [path[i+1]];
    } else {
      if (this._dag[path[i]].indexOf(path[i+1]) > -1) {
        // do nothing
      } else {
        this._dag[path[i]].push(path[i+1]);
      }
    }
  }
  done();
};

DAGBuilder.prototype._flush = function (callback) {
  console.log(this._dag);
  this.push(this._dag);
  callback();
};

module.exports = DAGBuilder;
