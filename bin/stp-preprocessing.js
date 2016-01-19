#!/usr/bin/node

var CalculateLocalPaths = require('../lib/localPaths.js'),
    ClusterAlgorithm = require('../lib/cluster.js'),
    Fetcher = require('lc-client').Fetcher,
    fs = require('fs'),
    GraphBuilder = require('../lib/buildGraph.js');

// TODO: input parameters etc.

var fetcher = new Fetcher({"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]});
var graphBuilder = new GraphBuilder();
fetcher.buildConnectionsStream({"departureTime": new Date("2015-10-10T10:00")},
                               function (connectionStream) {
                                 var lpb = new CalculateLocalPaths(new Date("2015-10-10T00:00"),
                                                               {"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]});
                                 lpb.on('data', function (result) {
                                   fs.writeFileSync('stp-output.json',
                                                    JSON.stringify(result),
                                                    'utf-8');
                                 });
                                 connectionStream
                                    .pipe(graphBuilder)
                                    .pipe(new ClusterAlgorithm(100))
                                    .pipe(lpb);
                               });
