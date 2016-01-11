#!/usr/bin/node

var Fetcher = require('lc-client').Fetcher,
    GraphBuilder = require('../lib/buildGraph.js'),
    ClusterAlgorithm = require('../lib/cluster.js'),
    CalculateLocalPaths = require('../lib/localPaths.js'),
    path = require('path'),
    fs = require('fs'),
    program = require('commander'),
    assert = require('assert'),
    JSONStream = require('JSONStream');
var LocalPathBuilder = require('../lib/localPathBuilder.js');
var DAGBuilder = require('../lib/dagBuilder.js');

// TODO:
// 1. Input parameters: start and end date to limit the number of connections
//    to process + configuration parameters

var fetcher = new Fetcher({"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]});
var graphBuilder = new GraphBuilder(null);
fetcher.buildConnectionsStream({"departureTime": new Date("2015-10-10T10:00")},
                               function (connectionStream) {
                                  connectionStream
                                    .pipe(graphBuilder)
                                    .pipe(new ClusterAlgorithm(100))
                                    .pipe(new CalculateLocalPaths(new Date("2015-10-10T10:00"), {"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]}));
                               });
