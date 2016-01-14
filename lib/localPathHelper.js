var stream = require('stream'),
    util = require('util');

var LocalPathHelper = function (localPathStream) {
  stream.Transform.call(this, {objectMode : true});
  this._localPathStream = localPathStream;
};

util.inherits(LocalPathHelper, stream.Transform);

LocalPathHelper.prototype._write = function (result, encoding, done) {
  this._result = result;
  done();
};

LocalPathHelper.prototype._flush = function (callback) {
  this._localPathStream.push(this._result);
  callback();
};

module.exports = LocalPathHelper;
