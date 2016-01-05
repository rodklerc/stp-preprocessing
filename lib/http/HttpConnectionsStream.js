var Readable = require('stream').Readable,
    jsonld = require('jsonld'),
    util = require('util');

//This class fetches 1 stream of Connections from a Connections Stream Server
//A jsonld-stream is generated
var HttpConnectionsStream = function (starturl, http) {
  Readable.call(this, {objectMode: true});
  this._url = starturl;
  this._http = http; //http fetcher with a limited amount of concurrent requests
  this._connections = [];
  this["@context"] = {
    "lc" : "http://semweb.mmlab.be/ns/linkedconnections#",
    "Connection" : "http://semweb.mmlab.be/ns/linkedconnections#Connection",
    "gtfs" : "http://vocab.gtfs.org/terms#",
    "arrivalTime" : "http://semweb.mmlab.be/ns/linkedconnections#arrivalTime",
    "arrivalStop" : {
      "@id": "http://semweb.mmlab.be/ns/linkedconnections#arrivalStop",
      "@type": "@id"
    },
    "departureTime" : "http://semweb.mmlab.be/ns/linkedconnections#departureTime",
    "departureStop" : {
      "@id": "http://semweb.mmlab.be/ns/linkedconnections#departureStop",
      "@type": "@id"
    },
    "hydra" : "http://www.w3.org/ns/hydra/core#"
  };
};

util.inherits(HttpConnectionsStream, Readable);

HttpConnectionsStream.prototype.close = function () {
  this.push(null);
};

HttpConnectionsStream.prototype._fetchNextPage = function () {
  var self = this;
  return this._http.get(this._url).then(function (result) {
    var document = JSON.parse(result.body);
    //find next page and all connection by framing the pages according to our own context
    return jsonld.promises.frame(document, {"@graph": {"http://www.w3.org/ns/hydra/core#nextPage" : {}}})
      .then(function (data) {
        self._url = data["@graph"][0]["http://www.w3.org/ns/hydra/core#nextPage"]["@id"];
        return jsonld.promises.frame(document, {"@context":self["@context"], "@type" : "Connection"}).then(function (data) {
          return data["@graph"];
        });
    });
  }, function (error) {
    //we have received an error, let's close the stream and output the error
    console.error("Error: ", error);
    self.push(null);
  });
};

HttpConnectionsStream.prototype._pushNewConnection = function (connection) {
  if (connection["departureTime"]) {
    connection["departureTime"] = new Date(connection["departureTime"]);
  }
  if (connection["arrivalTime"]) {
    connection["arrivalTime"] = new Date(connection["arrivalTime"]);
  }
  this.push(connection);
}

HttpConnectionsStream.prototype._read = function () {
  if (this._connections.length === 0) {
    //can we do something smarter with prefetching data?
    var self = this;
    this._fetchNextPage().then(function (connections) {
      if (connections.length === 0) {
        console.error('end of the stream: empty page encountered');
        self.push(null);
      } else {
        self._connections = connections;
        self._pushNewConnection(self._connections.shift());
      }
    });
  } else {
    this._pushNewConnection(this._connections.shift());
  }
};

module.exports = HttpConnectionsStream;
