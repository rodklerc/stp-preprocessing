var stream = require('stream');
var util = require('util');
var PriorityQueue = require('priorityqueuejs');

// TODO use database instead of working memory (the graph could be huge if the
// transport network considered is large).

// TODO make code more modular (choose stop criterion, ...)

/**
 * A ClusterAlgorithm is a duplex stream. The input should be the adjacency list
 * representation of the graph produced by a GraphBuilder.
 * (Note that we could equally use a parameter instead of a stream, as
 *  GraphBuilder currently just generates all output data at once. In other
 *  words, we expect *exactly* one object to be passed to this stream.)
 * @param U Maximum cluster size.
 */
var ClusterAlgorithm = function (U) {
  stream.Transform.call(this, {objectMode : true});

  this._U = U;

  // We use a priority queue to store the inter-cluster distance. This will
  // allow us to calculate the next merge efficiently.
  this._distanceQueue = new PriorityQueue(function(a, b) {
    return a.distance - b.distance;
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
ClusterAlgorithm.prototype._calculateWeight = function(cluster1, cluster2) {
  var acc = 0;
  for (var i1 in this._clustering[cluster1]) {
    var stop1 = this._clustering[cluster1][i1];
    for (var i2 in this._graph[stop1]) {
      var stop2 = this._clustering[i2];
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
ClusterAlgorithm.prototype._weight = function(cluster1, cluster2) {
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
ClusterAlgorithm.prototype._clusterDistance = function(cluster1, cluster2) {
  var n1 = this._clustering[cluster1].length;
  var n2 = this._clustering[cluster2].length;
  return 1/n1 * 1/n2 * (this._weight(cluster1, cluster2)/Math.sqrt(n1) +
                        this._weight(cluster2, cluster1)/Math.sqrt(n2));
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
    // Case 2: not up to date anymore
    } else if (top.mergeCounter1 < this._nrOfMerges[c1] || top.mergeCounter2 < this._nrOfMerges[c2]) {
      this._distanceQueue.deq();
    // Case 3: merging these clusters would lead to a cluster of size > U
    } else if (this._clustering[c1].length + this._clustering[c2].length > this._U) {
      // Merging these clusters now is impossible, and so it is in the future.
      // This element of the queue may thus be safely removed.
      this._distanceQueue.deq();
    // Case 4: these clusters aren't neighbours.
    } else if (this._weight(c1, c2) === 0 || this._weight(c2, c1) === 0) {
      // If c1 or c2 is merged with another cluster, then c1 and c2 may become
      // neighbours again. However, when we merge clusters, we add all pairwise
      // distances to the priority queue again. So this element of the queue
      // may be safely ignored as well.
      this._distanceQueue.deq();
    // Case 5: we have found a valid merge
    } else {
      toMerge = [c1, c2];
      found = true;
    }

  }
  return toMerge;
}

/**
  * Merges two clusters and updates all data structures.
 */
ClusterAlgorithm.prototype._mergeClusters = function(toMerge) {
  this._nrOfClusters--;

  // Merge the smallest cluster into the largest one.
  var c1, c2;
  if (this._clustering[toMerge[0]].length <= this._clustering[toMerge[1]].length) {
    c1 = toMerge[1];
    c2 = toMerge[0];
  } else {
    c1 = toMerge[0];
    c2 = toMerge[1];
  }

  console.log('merge ' + c2 + ' into ' + c1);

  // We first calculate the inter-cluster weights for the new cluster, making
  // use of the following property:
  // Let c1 and c2 be two different clusters. Denote the result of merging
  // c1 and c2 as "c1+c2". Let b be a random cluster so that b is not equal
  // to c1, c2 or c1+c2. Then we have that:
  // (1) weight(b, c1+c2) = weight(b, c1) + weight(b, c2)
  // (2) weight(c1+c2, b) = weight(c1, b) + weight(c2, b)
  // TODO: make loop more efficient by not iterating over non-existant clusters
  for (var cluster in this._existingClusters) {
    if (this._existingClusters[cluster]) {
      this._clusteringWeights[c1][cluster] = this._weight(c1, cluster) + this._weight(c2, cluster);
      this._clusteringWeights[cluster][c1] = this._weight(cluster, c1) + this._weight(cluster, c2);
    }
  }

  // c2 disappears
  this._existingClusters[c2] = false;
  // c1 is technically a "new" cluster
  this._nrOfMerges[c1] += 1;
  // All stops from c2 now become stops for c1. Note that, by construction,
  // the stops of two different clusters are always disjoint.
  for (var stop in this._clustering[c2]) {
    this._clustering[c1].push(this._clustering[c2][stop]);
    this._inverseClustering[this._clustering[c2][stop]] = c1;
  }

  // We now calculate all distances between the new cluster and the existing
  // clusters and add these to the priority queue. Note that we have already
  // calculated the weights.
  // TODO: make loop more efficient by not iterating over non-existant clusters
  for (var cluster in this._existingClusters) {
    if (this._existingClusters[cluster]) {
      this._distanceQueue.enq({clusters: [c1, cluster],
                               distance: this._clusterDistance(c1, cluster),
                               mergeCounter1: this._nrOfMerges[c1],
                               mergeCounter2: this._nrOfMerges[c2]});
    }
  }
}

ClusterAlgorithm.prototype._write = function (graph, encoding, done) {
  this._graph = graph;
  done();
}

// TODO: put this in a seperate stream
ClusterAlgorithm.prototype._statistics = function () {
  console.log('number of stops: ' + this._nrOfStations);
  console.log('number of clusters: ' + this._nrOfClusters);

  var avg = 0;
  for (var c in this._existingClusters) {
    if (this._existingClusters[c]) {
      avg += this._clustering[c].length;
    }
  }

  console.log('average cluster size: ' + (avg/this._nrOfClusters));

  var cutEdges = 0;
  var cutSize = 0;
  var edges = 0;
  var borderStations = 0;
  for (var stop in this._inverseClustering) {
    var isBorder = false;
    for (var neighbouringStop in this._graph[stop]) {
      if (this._inverseClustering[neighbouringStop] != this._inverseClustering[stop]) {
        isBorder = true;
        cutEdges++;
        cutSize += this._graph[stop][neighbouringStop];
      }
      edges++;
    }
    if (isBorder)
      borderStations++;
  }

  console.log('cut size: ' + cutSize);
  console.log('cut edges: ' + cutEdges + ' (' + (cutEdges/edges)*100 + ')');
  console.log('border nodes: ' + borderStations + ' (' + (borderStations/this._nrOfStations)*100 + ')');
}

ClusterAlgorithm.prototype._flush = function (callback) {
  // STEP 1: Initialize all data structures

  // Initially, there is a one-to-one correspondence between stops and clusters.
  this._nrOfClusters = 0;
  this._nrOfStations = 0;
  for (var stop in this._graph) {
    this._nrOfClusters++;
    this._nrOfStations++;
    this._existingClusters[stop] = true;
    this._clustering[stop] = [stop];
    this._inverseClustering[stop] = stop;
    this._nrOfMerges[stop] = 0;
  }

  // Calculate distances between clusters.
  for (var stop1 in this._graph) {
    for (var stop2 in this._graph) {
      if (stop1 <= stop2) { // by symmetry of the distance function
        var dist = this._clusterDistance(stop1, stop2);
        this._distanceQueue.enq({clusters: [stop1, stop2],
                                 distance: dist,
                                 mergeCounter1: 0,
                                 mergeCounter2: 0});
      }
    }
  }

  // STEP 2: repeatedly merge clusters until a stop condition is satisfied
  var done = false;
  while (!done) {
    var toMerge = this._determineClustersToMerge();
    if (toMerge != null) {
      this._mergeClusters(toMerge);
    } else {
      done = true;
    }
  }

  // TODO border station reduction

  // STEP 3: print statistics
  this._statistics();

  this.push({clustering: this._clustering,
             inverseClustering: this._inverseClustering,
             graph: this._graph,
             existingClusters: this._existingClusters});
  callback();
}

module.exports = ClusterAlgorithm;
