#!/usr/bin/node

var Fetcher = require('lc-client').Fetcher,
    GraphBuilder = require('../lib/buildGraph.js'),
    path = require('path'),
    fs = require('fs'),
    program = require('commander'),
    assert = require('assert');

// TODO:
// 1. Input parameters: start and end date to limit the number of connections
//    to process + configuration parameters

var fetcher = new Fetcher({"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]});
var graphBuilder = new GraphBuilder(null);
fetcher.buildConnectionsStream({"departureTime": new Date("2015-10-10T04:00")},
                               function (connectionStream) {
                                  connectionStream.pipe(graphBuilder).pipe(fs.createWriteStream('graph.txt'));
                               });
