var stream = require('stream');
var util = require('util');
var _und = require("underscore");

var DAGAggregator = function () {
  stream.Transform.call(this, {objectMode : true});
  this._dags = {};
};

util.inherits(DAGAggregator, stream.Transform);

DAGAggregator.prototype._write = function (dag, encoding, done) {
  this._dags[dag.cluster] = dag.dag;
  done();
};

DAGAggregator.prototype._flush = function (callback) {
  console.log(this._dags);
  this.push(this._dags);
  callback();
};

module.exports = DAGAggregator;
