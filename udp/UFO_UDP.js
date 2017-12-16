const util = require('util');
const dgram = require('dgram');
const Constants = require('./Constants.js');
const UDPUtils = require('./UDPUtils.js');
const Utils = require('../Utils.js');

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
      // Convert all messages to UTF-8 because UFOs always send ASCII.
      typeof callback === 'function' && callback(msg.toString('utf8'), rinfo.size);
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
 // Sends the given message to the UFO and runs the callback once the message is sent.
 UFO_UDP.prototype._send = function(msg, callback) {
   this._socket.send(msg, Constants.ufoPort, this._options.host, callback);
 }
// Sends the given message to the UFO and runs the callback once a response is received.
UFO_UDP.prototype._sendAndWait = function(msg, callback) {
  this._receiveCallback = callback;
  this._socket.send(msg, Constants.ufoPort, this._options.host);
}
// Sends the given message to the UFO and runs the callback once a response is received and verified.
UFO_UDP.prototype._sendAndVerify = function(msg, expected, callback) {
  this._sendAndWait(msg, function(resp, size) {
    var error = null;
    if (expected !== resp) {
      error = new Error('Unexpected UDP response.');
    }
    typeof callback === 'function' && callback(error, resp, size);
  }.bind(this));
}
// Puts the socket in command mode.
UFO_UDP.prototype._commandMode = function(callback) {
  if (this._dead) return;
  this.hello(function() {
    this._send(Constants.commandSet.ok.send, callback);
  }.bind(this));
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
  this._sendAndWait(Constants.udpHello, function(msg, size) {
    // Only invoke the callback if the IP address matches.
    var ufo = UDPUtils.getHelloResponse(msg);
    if (ufo.ip === this._options.host) {
      typeof callback === 'function' && callback();
    }
  }.bind(this));
}

/*
 * Reconfiguration methods
 */
UFO_UDP.prototype.factoryReset = function(callback) {
  this._commandMode(function() {
    const command = Constants.commandSet.factoryReset;
    this._sendAndVerify(command.send, command.receive, function(err, msg, size) {
      if (err) this._socket.emit('error', err);
      // Override the callback if requested.
      if (typeof callback === 'function') this._ufo._disconnectCallback = callback;
      this._ufo.disconnect();
    }.bind(this));
  }.bind(this));
}
UFO_UDP.prototype.asWifiClient = function(options, callback) {
  // Parse options.
  const auth = Utils.checkWithDefault(options.auth, ['OPEN', 'SHARED', 'WPAPSK', 'WPA2PSK'], 'OPEN');
  switch (auth) {
    case 'WPAPSK':
    case 'WPA2PSK':
      var encryption = Utils.checkWithDefault(options.encryption, ['TKIP', 'AES'], 'AES');
      break;
    case 'SHARED':
      var encryption = Utils.checkWithDefault(options.encryption, ['WEP-H', 'WEP-A'], 'WEP-A');
      break;
    default: // OPEN
      var encryption = Utils.checkWithDefault(options.encryption, ['NONE', 'WEP-H', 'WEP-A'], 'NONE');
      break;
  }
  // Assemble the final options object.
  const finalOptions = {
    ssid: options.ssid,
    auth: auth,
    encryption: encryption,
    passphrase: options.passphrase
  }
  // Switch to command mode.
  this._commandMode(function(options) {
    // Set the SSID.
    const ssidCmd = util.format(Constants.commandSet.wifiClientSsid.send, options.ssid);
    this._sendAndVerify(ssidCmd, Constants.commandSet.wifiClientSsid.receive, function(options, msg, size) {
      console.log('Set SSID.');
      // Set the passphrase/auth configuration.
      const authCmd = util.format(Constants.commandSet.wifiClientAuth.send, options.auth, options.encryption, options.passphrase);
      this._sendAndVerify(authCmd, Constants.commandSet.wifiClientAuth.receive, function(msg, size) {
        console.log('Set auth info.');
        // Set the UFO to client (STA) mode.
        const modeCmd = util.format(Constants.commandSet.wifiMode.send, 'STA');
        this._sendAndVerify(modeCmd, Constants.commandSet.wifiMode.receive, function(msg, size) {
          console.log('Set to client mode.');
          // Reboot the UFO.
          this._send(Constants.commandSet.reboot.send, function() {
            console.log('Rebooted.');
            // Override the callback if requested.
            if (typeof callback === 'function') this._ufo._disconnectCallback = callback;
            this._ufo.disconnect();
          }.bind(this));
        }.bind(this));
      }.bind(this));
    }.bind(this, options));
  }.bind(this, finalOptions));
}
