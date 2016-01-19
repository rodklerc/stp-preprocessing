#!/usr/bin/node

var CalculateLocalPaths = require('../lib/localPaths.js'),
    ClusterAlgorithm = require('../lib/cluster.js'),
    Fetcher = require('lc-client').Fetcher,
    fs = require('fs'),
    GraphBuilder = require('../lib/buildGraph.js'),
    program = require('commander');

function list(val) {
  return val.split(',');
}

program
  .version('0.0.1')
  .usage('[options] <output filename>')
  .option('-e, --entrypoints <es>', 'List of linked connections entry point URLs', list)
  .option('-s, --startTime <t>', 'Scan connections departing no earlier than the point in time represented by this date and time string')
  .option('-i, --increment <i>', 'Scan connections starting from the start time, start time + "increment" minutes, start time + 2*"increment" minutes, ...', parseInt)
  .option('-m, --maxMinutes <m>', 'Stop scanning connections when reaching start time + maxMinutes', parseInt)
  .option('-U, --maxClusterSize <u>', 'Maximum cluster size', parseInt)
  .arguments('<output>')
  .action(function (output, opts) {
    outputFilename = output;
  })
  .parse(process.argv);

var entryPoints = {"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]};
var startTime = new Date("2015-10-10T03:00");
var increment = 10;
var maxMinutes = 24*60;
var maxClusterSize = 100;

if (typeof outputFilename === 'undefined') {
  console.error('Please specify an output file.');
  process.exit(1);
}

if (program.entrypoints) entryPoints = {"entrypoints" : program.entrypoints};
if (program.startTime) startTime = new Date(program.startTime);
if (program.increment) increment = program.increment;
if (program.maxMinutes) maxMinutes = program.maxMinutes;
if (program.maxClusterSize) maxClusterSize = program.maxClusterSize;

var fetcher = new Fetcher(entryPoints);
var graphBuilder = new GraphBuilder();

fetcher.buildConnectionsStream({"departureTime": startTime},
                               function (connectionStream) {
                                 var lpb = new CalculateLocalPaths(startTime, increment, maxMinutes, entryPoints);
                                 lpb.on('data', function (result) {
                                   fs.writeFileSync(outputFilename,
                                                    JSON.stringify(result),
                                                    'utf-8');
                                 });

                                 connectionStream
                                    .pipe(graphBuilder)
                                    .pipe(new ClusterAlgorithm(maxClusterSize))
                                    .pipe(lpb);
                               });
