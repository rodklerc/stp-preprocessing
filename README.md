# stp-preprocessing

This JavaScript library builds [Scalable Transfer Patterns]{http://ad-publications.informatik.uni-freiburg.de/ALENEX_scalable_tp_BHS_2016.pdf} by using the linked connections data. This
preprocessing step will allow the connection scan algorithm to run faster.

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
the network. The clustering method used is *merge-based clustering*, as
described in the linked connections paper.

Step 3: Calculating local transfer patterns
===========================================

In the next step, all transfer patterns for intra-cluster connections are
calculated. We focus on transfer patterns w.r.t. the *earliest arrival time*.
To calculate all optimal journeys, we use the basic CSA algorithm. Note that
this approach is very inefficient. The efficiency could be improved by using
a profile CSA algorithm.


