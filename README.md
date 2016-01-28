# stp-preprocessing

This JavaScript library implements a variation on the preprocessing step of the
[Scalable Transfer Patterns](http://ad-publications.informatik.uni-freiburg.de/ALENEX_scalable_tp_BHS_2016.pdf)
approach. We implement this preprocessing step in terms of the basic connection
scan algorithm using linked connections. This preprocessing step will in turn
enable CSA to run faster.

Differences from the scalable transfer patterns-approach and limitations of this
preprocessing step:
* **Limitation:** The preprocessing step will probably not be faster than the non-scalable preprocessing
step using CSA. The reason is that the linked connections client does not
currently enable us to exploit previously calculated optimal routes.
* **Hypothesis**: The result of the preprocessing step should take less memory to store than
the result of the non-scalable preprocessing step.
* **Hypothesis**: Querying should also be faster compared to the non-scalable approach.
* **TODO**: Border station reduction is yet to be implemented.
* **TODO**: We currently ignore the *long-distance station* concept.
* **Limitation**: We focus on *earliest arrival time* queries, supporting other
  types of queries (e.g. Pareto optimal) only requires changes in the linked
  connections client and CSA implementation.
* **Limitation**: the preprocessing step is "memory-intensive", alternatively some
  sort of database could be used. *All output is written to a file.*
* **TODO**: the code is **NOT** optimized. When reading the code, suboptimal
  parts may be easily spotted.

Building transfer patterns
==========================

Use `bin/stp-preprocessing.js`, an explanation of the command line parameters
is given in that file. The output of this script consists of a JSON string
representing an object with the following fields:
* **graphs**: a mapping of cluster identifiers (which are just numbers) to an
  adjacency list representation of the transfer pattern graph for the corresponding
  cluster. The adjacency list representation is just an associative array mapping
  stop identifiers (numbers) to a list of stop identifiers. Note that a transfer
  pattern graph is a directed graph.
* **inverseClustering**: a mapping of stop identifiers to their cluster.
* **borderStations**: a mapping of stop identifiers to booleans, indicating whether
  the corresponding stop is classified as a border station.

The output of this preprocessing step may then be used by `stp-csa` to improve
query times.

**NOTE:** the input parameters of `bin/stp-preprocessing.js` should accurately
represent the time range for querying. For example, using transfer patterns
constructed based on the connections on 21/01/2016 will probably not yield
correct results for queries on 22/01/2016.

In the remainder of this section, we describe the various preprocessing steps
in more detail.

Step 1: Building a graph representation
---------------------------------------

The first preprocessing step consists of building a graph representation of the
transport network. The nodes of this graph are the stations in the network, and
there exists a *directed* edge between two nodes if and only if there is some
connection connecting the stations represented by the nodes (no matter the
time schedule). The edges are weighted by the number of such connections.

The graph is constructed by scanning all connections (using the linked connections
client) in a given time range. This time range should be chosen in such a way
that the edge weights will reflect the frequency of the corresponding connection
over the period of one year. If a certain connection doesn't exist for the given
time range, then queries using the transfer pattern data constructed based on
the connections in this time range will not take this connection into account.

Step 2: Clustering the graph
----------------------------

Now that the graph representation is available, we will be able to cluster
the network. The clustering method used is based on *merge-based clustering*, as
described in the paper on scalable transfer patterns.

Step 3: Calculating all minimal spanning trees
----------------------------------------------

We run CSA for each possible departure time and each possible departure station.
This gives us a minimal spanning tree representing all optimal routes between
the departure station and all other stations.

Step 4: Calculating transfer patterns
-------------------------------------

We "scan" every path in every MST produced in the previous step, extracting
every transfer station along the way. We only report paths between two stations
in the same cluster or between two border stations.

Step 5: Building transfer pattern graphs
----------------------------------------

For each cluster, we aggregate the transfer patterns for that cluster (produced
in the previous step) in a graph. We do not ensure that this graph is acyclic.
Every transfer pattern corresponds to a directed path in the graph. The converse
is however not true: there may be suboptimal or superfluous paths in the graph.
The compression we achieve by aggregating per cluster (instead of per stop, as
is done for traditional transfer patterns) may thus be considered to be "lossy".
Note that the presence of these paths will only influence the efficiency of
querying, not the correctness.

Building stop to route mapping
==============================

The script `bin/stop-route-mapping.js` builds a mapping of pairs of stops to
route ids. `(s,t)` is mapped to all routes containing a sequence `s,x_1,...,x_n,t`
of stops (`n>=0`). So in a certain sense this mapping represents the transitive
closure of the connections on each trip for this route.
