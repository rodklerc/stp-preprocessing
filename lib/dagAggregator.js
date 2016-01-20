var stream = require('stream'),
    util = require('util');

/** A TransferPatternGraphAggregator aggregates the output of multiple
  * TransferPatternGraphBuilder instances. There should be one transfer pattern
  * graph builder for every cluster.
  * There will be one output object consisiting of the following keys:
  * dags: mapping of cluster to transfer pattern graph as produced by a TransferPatternGraphBuilder
  * convexity: mapping of cluster to boolean, indicating if the cluster is convex or not
  * inverseClustering: mapping of stop id to cluster id
  * @param inverseClustering This parameter will be used as the "inverseClustering" field of the output object
  */
var TransferPatternGraphAggregator = function (inverseClustering, borderStations) {
  stream.Transform.call(this, {objectMode : true});
  this._graphs = {};
  this._convexity = {};
  this._inverseClustering = inverseClustering;
  this._borderStations = borderStations;
};

util.inherits(TransferPatternGraphAggregator, stream.Transform);

TransferPatternGraphAggregator.prototype._write = function (tpg, encoding, done) {
  this._graphs[tpg.cluster] = tpg.graph;
  this._convexity[tpg.cluster] = tpg.convex;
  done();
};

TransferPatternGraphAggregator.prototype._flush = function (callback) {
  this.push({graphs: this._graphs, convexity: this._convexity,
             inverseClustering: this._inverseClustering,
             borderStations: this._borderStations});
  callback();
};

module.exports = TransferPatternGraphAggregator;
