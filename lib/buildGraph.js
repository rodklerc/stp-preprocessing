var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

var GraphBuilder = function (config) {
    MongoClient.connect(config.connectionString,
                        function(err, db) {
                            assert.equal(null, err);
                            console.log('verbonden met database');
                            db.close();
                        });
};

GraphBuilder.prototype.handleConnection = function (connection) {
    console.log(connection);
};

module.exports = GraphBuilder;
