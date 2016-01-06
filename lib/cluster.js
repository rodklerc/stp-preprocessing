var stream = require('stream');
var util = require('util');
var PriorityQueue = require('priorityqueuejs');

// TODO use database instead of working memory (the graph could be huge if the
// transport network considered is large)

/**
 * A ClusterAlgorithm is a duplex stream. The input should be the adjacency list
 * representation of the graph produced by a GraphBuilder.
 * (Note that we could equally use a parameter instead of a stream, as
 *  GraphBuilder currently just generates all output data at once. In other
 *  words, we expect *exactly* one object to be passed to this stream.)
 */
var ClusterAlgorithm = function (U, k) {
  stream.Transform.call(this, {objectMode : true});

  this._U = U;
  this._k = k;

  // We use a priority queue to store the inter-cluster distance. This will
  // allow us to calculate the next merge efficiently.
  this._distanceQueue = new PriorityQueue(function(a, b) {
    return b.distance - a.distance;
  });

  // Every cluster will be given a numerical ID.
  // This array maps cluster ids to booleans and indicates if a cluster with
  // the given id still exists. Keeping this is information is necessary because
  // when we merge two clusters, we will only keep one cluster id.
  this._existingClusters = {};

  // Maps cluster ids to the stops in this cluster.
  this._clustering = {};

  // Maps cluster ids to the number of times another cluster was merged into
  // this cluster.
  this._nrOfMerges = {};

  // Two-dimensional array of cluster ids, mapping ordered pairs of clusters to
  // their inter-cluster weight.
  this._clusteringWeights = {};

  // Maps stops to the cluster in which they are contained.
  this._inverseClustering = {};
};

util.inherits(ClusterAlgorithm, stream.Transform);

/**
 * Calculates the weight of the edges between two clusters represented by their
 * cluster ids.
 * Note that this is an expensive calculation, especially when the clusters
 * are large.
 * WARNING: this is operation is NOT symmetric!
 */
ClusterAlgorithm.prototype._calculateWeight(cluster1, cluster2) {
  var acc = 0;
  for (var stop1 in this._clustering[cluster1]) {
    for (var stop2 in this._graph[stop1]) {
      if (this._inverseClustering[stop2] === cluster2) {
        acc += this._graph[stop1][stop2];
      }
    }
  }
  return acc;
}

/**
 * Uses caching and lazy loading to determine the inter-cluster weight.
 * Clusters are represented by their cluster ids.
 */
ClusterAlgorithm.prototype._weight(cluster1, cluster2) {
  if (this._clusteringWeights[cluster1] === undefined) {
    this._clusteringWeights[cluster1] = {};
  }
  if (this._clusteringWeights[cluster1][cluster2] === undefined) {
    this._clusteringWeights[cluster1][cluster2] = this._calculateWeight(cluster1, cluster2);
  }
  return this._clusteringWeights[cluster1][cluster2];
}

/**
 * Calculates the distance ("utility function" value) between two clusters.
 */
ClusterAlgorithm.prototype._clusterDistance(cluster1, cluster2) {
  var n1 = this._clustering[cluster1].length;
  var n2 = this._clustering[cluster2].length;

  return 1/n1 * 1/n2 *
         (this._weight(cluster1, cluster2)/Math.sqrt(n1) +
          this._weight(cluster2, cluster1)/Math.sqrt(n2);
}

/**
 * Determine the next two neighbouring clusters which should be merged.
 * Returns null if there are no valid merges possible.
 * The neighbouring partitions with the largest inter cluster distance are
 * merged first.
 */
ClusterAlgorithm.prototype._determineClustersToMerge = function () {
  var found = false;
  var toMerge = null;
  while (!found && !this._distanceQueue.isEmpty()) {
    var top = this._distanceQueue.peek();
    var c1 = top.clusters[0], c2 = top.clusters[1];
    // Case 1: at least one of the two clusters has been merged into another one
    if (!this._existingClusters[c1] || !this._existingClusters[c2]) {
      // This element of the queue is not needed anymore and can be safely
      // removed.
      this._distanceQueue.deq();
    // Case 2: merging these clusters would lead to a cluster of size > U
    } else if (this._clustering[c1].length + this._clustering[c2].length > this._U) {
      // Merging these clusters now is impossible, and so it is in the future.
      // This element of the queue may thus be safely removed.
      this._distanceQueue.deq();
    // Case 3: these clusters aren't neighbours.
    } else if (this._weight(c1, c2) === 0 || this._weight(c2, c1) === 0) {
      // If c1 or c2 is merged with another cluster, then c1 and c2 may become
      // neighbours again. However, when we merge clusters, we add all pairwise
      // distances to the priority queue again. So this element of the queue
      // may be safely ignored as well.
      this._distanceQueue.deq();
    // Case 4: we have found a valid merge
    } else {
      toMerge = [c1, c2];
      found = true;
    }

  }
  return toMerge;
}

ClusterAlgorithm.prototype._write = function (graph, encoding, done) {
  this._graph = graph;
  done();
}

ClusterAlgorithm.prototype._flush = function (done) {
  // STEP 1: Initialize all data structures

  // Initially, there is a one-to-one correspondence between stops and clusters.
  for (var stop in graph) {
    this._existingClusters[stop] = true;
    this._clustering[stop] = [stop];
    this._inverseClustering[stop] = stop;
    this._nrOfMerges[stop] = 0;
  }

  // Calculate distances between clusters.
  for (var stop1 in graph) {
    for (var stop2 in graph) {
      this._distanceQueue.enq({clusters: [stop1, stop2],
                               distance: this._clusterDistance(stop1, stop2),
                               mergeCounter: 0});
    }
  }

  // STEP 2: repeatedly merge clusters until a stop condition is satisfied

  done();
}

module.exports = ClusterAlgorithm;
