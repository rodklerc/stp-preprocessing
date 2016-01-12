#!/usr/bin/node

var CalculateLocalPaths = require('../lib/localPaths.js'),
    ClusterAlgorithm = require('../lib/cluster.js'),
    Fetcher = require('lc-client').Fetcher,
    GraphBuilder = require('../lib/buildGraph.js');

// TODO: input parameters etc.

var fetcher = new Fetcher({"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]});
var graphBuilder = new GraphBuilder();
fetcher.buildConnectionsStream({"departureTime": new Date("2015-10-10T10:00")},
                               function (connectionStream) {
                                  connectionStream
                                    .pipe(graphBuilder)
                                    .pipe(new ClusterAlgorithm(100))
                                    .pipe(new CalculateLocalPaths(new Date("2015-10-10T10:00"),
                                                                  {"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]})
                                    .on('data', function (result) {
                                      console.log(result);
                                    }));
                               });
