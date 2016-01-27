#!/usr/bin/node

var Fetcher = require('lc-client').Fetcher,
    fs = require('fs'),
    program = require('commander'),
    StopTripMapper = require('../lib/stopTripMapper.js');

function list(val) {
  return val.split(',');
}

program
  .version('0.0.1')
  .usage('[options] <output filename>')
  .option('-e, --entrypoints <es>', 'List of linked connections entry point URLs', list)
  .option('-s, --startTime <t>', 'Scan connections departing no earlier than the point in time represented by this date and time string')
  .arguments('<output>')
  .action(function (output, opts) {
    outputFilename = output;
  })
  .parse(process.argv);

var entryPoints = {"entrypoints" : ["http://belgianrail.linkedconnections.org/connections"]};
var startTime = new Date("2016-01-08T07:29");

if (program.entrypoints) entryPoints = {"entrypoints" : program.entrypoints};
if (program.startTime) startTime = new Date(program.startTime);

console.log(entryPoints);
console.log(startTime);

if (typeof outputFilename === 'undefined') {
  console.error('Please specify an output file.');
  process.exit(1);
}

var fetcher = new Fetcher(entryPoints);
fetcher.buildConnectionsStream({"departureTime": startTime},
                               function (connectionStream) {
                                 var stm = new StopTripMapper();
                                 connectionStream.pipe(stm);
                                 stm.on('data', function (result) {
                                   fs.writeFileSync(outputFilename,
                                                    JSON.stringify(result),
                                                    'utf-8');
                                 });
                               });
