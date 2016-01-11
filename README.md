# stp-preprocessing

This JavaScript library implements a variation on the preprocessing step of the
[Scalable Transfer Patterns](http://ad-publications.informatik.uni-freiburg.de/ALENEX_scalable_tp_BHS_2016.pdf)
approach. We implement this preprocessing step in terms of the basic connection
scan algorithm using linked connections. This preprocessing step will in turn
enable CSA to run faster.

Differences from the scalable transfer patterns-approach and limitations of this
preprocessing step:
* The preprocessing step will not be faster than the non-scalable preprocessing
step using CSA. The reason is that the linked connections client does not
currently enable us to exploit previously calculated optimal routes.
* The result of the preprocessing step should take less memory to store than
the result of the non-scalable preprocessing step.
* Querying should also be faster compared to the non-scalable approach.
* Border station reduction is yet to be implemented.
* We currently ignore the *long-distance station* concept.
* We focus on *earliest arrival time* queries.

Step 1: Building a graph representation
=======================================

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
============================

Now that the graph representation is available, we will be able to cluster
the network. The clustering method used is based on *merge-based clustering*, as
described in the paper on scalable transfer patterns.

Step 3: Calculating all minimal spanning trees
==============================================

We run CSA for each possible departure time and each possible departure station.
This gives us a minimal spanning tree representing all optimal routes between
the departure station and all other stations.

Step 4: Calculating local transfer patterns
===========================================

In the next step, all transfer patterns for intra-cluster connections are
calculated. We do this by extracting all paths from each station in the MST
to the departure station (in a certain sense: the root of the MST). We stop
processing a path when it leads outside of the departure station cluster.

Step 5: Calculating inter-cluster transfer patterns
===================================================

 
