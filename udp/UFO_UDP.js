const dgram = require('dgram');
const Constants = require('./Constants.js');
const UDPUtils = require('./UDPUtils.js');

// This string is used to enable command mode after receiving a hello response.
const udpOk = "+ok";

/*
 * Exports
 */

var UFO_UDP = module.exports = function(ufo, options) {
  // Capture the parent UFO.
  this._ufo = ufo;
  // Flag that tracks the state of this socket.
  this._dead = false;
  // Capture the options provided by the user.
  this._options = Object.freeze(options);
  // Define the UDP socket.
  this._socket = dgram.createSocket('udp4');
  this._error = null;
  // Route received messages to whatever the current callback is.
  this._receiveCallback = null;
  this._socket.on('message', function(msg, rinfo) {
    if (!this._error) {
      var callback = this._receiveCallback;
      typeof callback === 'function' && callback(msg, rinfo.size);
    }
  }.bind(this));
  // Capture errors so we can respond appropriately.
  this._socket.on('error', function(err) {
    this._dead = true;
    this._error = error;
    this._socket.close();
  }.bind(this));
  // The socket has been closed; react appropriately.
  this._socket.on('close', function() {
    this._socket.unref();
    this._ufo.emit('udpDead', this._error);
  }.bind(this));
};

// Export static discovery method.
UFO_UDP.discover = require('./Discovery.js');

/*
 * Private methods
 */
// Convenience method that sends the given message to the UFO.
UFO_UDP.prototype._sendMsg = function(msg, callback) {
  this._receiveCallback = callback;
  this._socket.send(msg, Constants.ufoPort, this._options.host);
}

/*
 * Core methods
 */
UFO_UDP.prototype.connect = function(callback) {
  if (this._dead) return;
  var port = this._options.port;
  if (port >= 0) {
    this._socket.bind(port);
  } else {
    this._socket.bind();
  }
}
UFO_UDP.prototype.disconnect = function() {
  if (this._dead) return;
  // We're intentionally closing this connection.
  // Don't allow it to be used again.
  this._dead = true;
  this._socket.close();
}
UFO_UDP.prototype.hello = function(callback) {
  if (this._dead) return;
  this._sendMsg(Constants.udpHello, function(msg, size) {
    // Only invoke the callback if the IP address matches.
    var ufo = UDPUtils.getHelloResponse(msg);
    if (ufo.ip === this._options.host) {
      typeof callback === 'function' && callback();
    }
  }.bind(this));
}
