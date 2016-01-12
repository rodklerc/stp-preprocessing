var stream = require('stream'),
    util = require('util');

/** A DAGAggregator aggregates the output of multiple DAGBuilders. There should
  * be one DAGBuilder for every cluster. The output is an object with two
  * values:
  * dags: mapping of cluster to DAG as produced by a DAGBuilder
  * convexity: mapping of cluster to boolean, indicating if the cluster is
  * convex or not
  */
var DAGAggregator = function () {
  stream.Transform.call(this, {objectMode : true});
  this._dags = {};
  this._convexity = {};
};

util.inherits(DAGAggregator, stream.Transform);

DAGAggregator.prototype._write = function (dag, encoding, done) {
  this._dags[dag.cluster] = dag.dag;
  this._convexity[dag.cluster] = dag.convex;
  done();
};

DAGAggregator.prototype._flush = function (callback) {
  this.push({dags: this._dags, convexity: this._convexity});
  callback();
};

module.exports = DAGAggregator;
