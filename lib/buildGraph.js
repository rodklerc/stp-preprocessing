var assert = require('assert');
var stream = require('stream');
var util = require('util');

var GraphBuilder = function (db) {
    stream.Writable.call(this, {objectMode : true});
    this._db = db;
};

util.inherits(GraphBuilder, stream.Writable);

GraphBuilder.prototype._write = function (connection, encoding, done) {
    console.log(connection);
    done();
}

module.exports = GraphBuilder;
