#!/usr/bin/node

var Fetcher = require('../lib/Fetcher.js'),
    GraphBuilder = require('../lib/buildGraph.js'),
    path = require('path'),
    fs = require('fs'),
    program = require('commander');

// TODO:
// 1. parameters: begin- en einddatum, configuratie, db of geheugen
// 2. momenteel wordt de graaf en de clustering in een database opgeslagen, voorzie
//    ook opslag in het geheugen voor kleinere netwerken
// 3. code beter opsplitsen

var fetcher = new Fetcher({"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]});
var graphBuilder = new GraphBuilder({"connectionString" : "mongodb://localhost:27017/qsdf"});

/*fetcher.buildConnectionsStream({"departureTime": new Date("2015-10-10T10:00")},
                               function (connectionStream) {
				   connectionStream.on('data', graphBuilder.handleConnection);
                               });*/
