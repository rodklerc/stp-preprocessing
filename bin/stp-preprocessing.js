#!/usr/bin/node

var Fetcher = require('lc-client').Fetcher,
    GraphBuilder = require('../lib/buildGraph.js'),
    path = require('path'),
    fs = require('fs'),
    program = require('commander'),
    assert = require('assert');

var MongoClient = require('mongodb').MongoClient;

// TODO:
// 1. parameters: begin- en einddatum, configuratie, db of geheugen
// 2. momenteel wordt de graaf en de clustering in een database opgeslagen, voorzie
//    ook opslag in het geheugen voor kleinere netwerken
// 3. code beter opsplitsen

var mongoDb;
MongoClient.connect("mongodb://localhost/stp",
                    function(err, db) {
                        assert.equal(null, err);
                        mongoDb = db;
                    });

var fetcher = new Fetcher({"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]});
var graphBuilder = new GraphBuilder(mongoDb);

fetcher.buildConnectionsStream({"departureTime": new Date("2015-10-10T10:00")},
                               function (connectionStream) {
                                  connectionStream.pipe(graphBuilder);
                               });
