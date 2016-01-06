#!/usr/bin/node

var Fetcher = require('lc-client').Fetcher,
    GraphBuilder = require('../lib/buildGraph.js'),
    ClusterAlgorithm = require('../lib/cluster.js'),
    path = require('path'),
    fs = require('fs'),
    program = require('commander'),
    assert = require('assert'),
    JSONStream = require('JSONStream');

// TODO:
// 1. Input parameters: start and end date to limit the number of connections
//    to process + configuration parameters

// -- START DEBUG --
// Calculate clustering for a very simple graph.
/*var c = new ClusterAlgorithm(3);
c.write(JSON.parse('{"1":{},"2":{"1":3,"3":30},"3":{"2":30,"4":30},"4":{"3":30,"5":30},"5":{"4":30,"6":30,"8":40,"9":45},"6":{"5":35,"14":2},"7":{"8":40},"8":{"7":40,"5":40},"9":{"5":40,"10":40},"10":{"9":45},"11":{"12":10},"12":{"11":10,"13":5},"13":{"12":5},"14":{"6":2,"17":10,"15":20},"15":{"14":20,"16":20},"16":{"15":20},"17":{"16":10}}'));
c._flush(function () { });*/
// -- END DEBUG --

var fetcher = new Fetcher({"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]});
var graphBuilder = new GraphBuilder(null);
fetcher.buildConnectionsStream({"departureTime": new Date("2015-10-10T04:00")},
                               function (connectionStream) {
                                  connectionStream.pipe(graphBuilder).pipe(new ClusterAlgorithm(10));
                               });
