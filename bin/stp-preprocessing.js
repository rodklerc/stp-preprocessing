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

// TODO:
// 1. Input parameters: start and end date to limit the number of connections
//    to process + configuration parameters

// -- START DEBUG CLUSTERING --
// Calculate clustering for a very simple graph.
/*var c = new ClusterAlgorithm(6);
c.write(JSON.parse('{"1":{},"2":{"1":3,"3":30},"3":{"2":30,"4":30},"4":{"3":30,"5":30},"5":{"4":30,"6":30,"8":40,"9":45},"6":{"5":35,"14":2},"7":{"8":40},"8":{"7":40,"5":40},"9":{"5":40,"10":40},"10":{"9":45},"11":{"12":10},"12":{"11":10,"13":5},"13":{"12":5},"14":{"6":2,"17":10,"15":20},"15":{"14":20,"16":20},"16":{"15":20},"17":{"16":10}}'));
c._flush(function () { });*/
// -- END DEBUG CLUSTERING --

// -- START DEBUG LOCAL TPS --
fs.createReadStream('nmbs100.txt')
  .pipe(JSONStream.parse())
  .pipe(new CalculateLocalPaths(new Date("2015-10-10T10:00"), {"entrypoints" : ["http://belgianrail.linkedconnections.org"]}));
// -- END DEBUG LOCAL TPS --

// -- START DEBUG LOCAL TPS --
/*var inverseClustering = {};
inverseClustering[1] = 1;
inverseClustering[2] = 1;
inverseClustering[3] = 1;
inverseClustering[4] = 2;
inverseClustering[5] = 1;
inverseClustering[6] = 1;
inverseClustering[7] = 3;
inverseClustering[8] = 3;
inverseClustering[9] = 1;
inverseClustering[10] = 1;
inverseClustering[11] = 1;
var lpb = new LocalPathBuilder(1, inverseClustering);
lpb.write({"@id": 1,
           departureStop: 1,
           arrivalStop: 2,
           departureTime: new Date("2015-10-10T10:00"),
           arrivalTime: new Date("2015-10-10T10:05"),
           "gtfs:trip": { "@id": 1 }
          });
lpb.write({"@id": 2,
           departureStop: 2,
           arrivalStop: 3,
           departureTime: new Date("2015-10-10T10:05"),
           arrivalTime: new Date("2015-10-10T10:15"),
           "gtfs:trip": { "@id": 1 },
           previous: 1 });
lpb.write({"@id": 3 ,
           departureStop: 3,
           arrivalStop: 4,
           departureTime: new Date("2015-10-10T10:15"),
           arrivalTime: new Date("2015-10-10T10:25"),
           "gtfs:trip": { "@id": 1 },
           previous: 2 });
lpb.write({"@id": 4,
           departureStop: 1,
           arrivalStop: 5,
           departureTime: new Date("2015-10-10T10:10"),
           arrivalTime: new Date("2015-10-10T10:15"),
           "gtfs:trip": { "@id": 2 }
          });
lpb.write({"@id": 5,
           departureStop: 3,
           arrivalStop: 6,
           departureTime: new Date("2015-10-10T10:20"),
           arrivalTime: new Date("2015-10-10T10:25"),
           "gtfs:trip": { "@id": 3 },
           previous: 2});
lpb.write({"@id": 6,
           departureStop: 3,
           arrivalStop: 7,
           departureTime: new Date("2015-10-10T10:25"),
           arrivalTime: new Date("2015-10-10T10:35"),
           "gtfs:trip": { "@id": 4 },
           previous: 2});
lpb.write({"@id": 7,
           departureStop: 7,
           arrivalStop: 8,
           departureTime: new Date("2015-10-10T10:35"),
           arrivalTime: new Date("2015-10-10T10:40"),
           "gtfs:trip": { "@id": 4},
           previous: 6});
lpb.write({"@id": 8,
          departureStop: 9,
          arrivalStop: 10,
          departureTime: new Date("2015-10-10T10:35"),
          arrivalTime: new Date("2015-10-10T10:40"),
          "gtfs:trip": { "@id": 5}
         });
lpb.write({"@id": 9,
         departureStop: 10,
         arrivalStop: 11,
         departureTime: new Date("2015-10-10T10:40"),
         arrivalTime: new Date("2015-10-10T10:50"),
         "gtfs:trip": { "@id": 5},
         previous: 8
        });
lpb.end();*/
// -- END DEBUG LOCAL TPS --

/*var fetcher = new Fetcher({"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]});
var graphBuilder = new GraphBuilder(null);
fetcher.buildConnectionsStream({"departureTime": new Date("2015-10-10T10:00")},
                               function (connectionStream) {
                                  connectionStream
                                    .pipe(graphBuilder)
                                    .pipe(new ClusterAlgorithm(100))
                                    .pipe(new CalculateLocalPaths(new Date("2015-10-10T10:00"), {"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]}));
                               });*/
