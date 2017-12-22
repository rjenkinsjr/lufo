const util = require('util');
const dgram = require('dgram');
const Constants = lufoRequire('udp/Constants');
const UDPUtils = lufoRequire('udp/Utils');
const MiscUtils = lufoRequire('misc/Utils');

/*
 * Exports
 */

var Client = module.exports = function(ufo, options) {
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
  this._receiveParser = null;
  this._socket.on('message', function(msg, rinfo) {
    // Don't do anything if we've had a socket error.
    if (!this._error) {
      // Don't do anything unless we have a valid callback.
      var callback = this._receiveCallback;
      if (typeof callback === 'function') {
        // Convert all messages to UTF-8 because UFOs always send ASCII.
        var message = msg.toString('utf8') || '';
        // Determine if we had an error.
        var atError = null;
        if (message.startsWith(Constants.errAck)) {
          var code = message.substring(message.indexOf('=') + 1);
          var errorMsg = 'Unknown error';
          switch (code) {
            case '-1':
              errorMsg = 'Invalid command format (%s)';
              break;
            case '-2':
              errorMsg = 'Invalid command (%s)';
              break;
            case '-3':
              errorMsg = 'Invalid operation symbol (%s)';
              break;
            case '-4':
              errorMsg = 'Invalid parameter (%s)';
              break;
            case '-5':
              errorMsg = 'Operation not permitted (%s)';
              break;
            default:
              break;
          }
          atError = new Error(util.format(errorMsg, code));
          message = null;
        } else {
          // Parse this message and collapse it if possible.
          message = this._receiveParser(message);
          if (message.length === 0) {
            message = '';
          } else if (message.length === 1) {
            message = message[0];
          }
        }
        // Invoke the callback.
        callback(atError, message);
      }
    }
  }.bind(this));
  // Capture socket errors so we can respond appropriately.
  // These are not AT command errors; we handle those separately.
  this._socket.on('error', function(err) {
    this._dead = true;
    this._error = err;
    this._socket.close();
  }.bind(this));
  // The socket has been closed; react appropriately.
  this._socket.on('close', function() {
    this._socket.unref();
    this._ufo.emit('udpDead', this._error);
  }.bind(this));
};

// Export static discovery method.
Client.discover = require('./Discovery.js');

/*
 * Private methods
 */
// Puts the socket in command mode.
// If this method fails, the UFO object is disconnected with an error.
//
// Callback is required and accepts no arguments.
Client.prototype._commandMode = function(callback) {
  if (this._dead) return;
  // Say hello.
  // TODO allow different password
  this._sendAndWait(Constants.command('hello'), function(err, msg) {
    if (err) {
      // Give up if we couldn't say hello.
      if (err) this._socket.emit('error', err);
    } else {
      // Give up if the response did not come from the expected IP.
      var ufo = UDPUtils.parseHelloResponse(msg);
      // TODO 0.0.0.0 seems to be valid only when it's in AP mode, we should check for that
      if (ufo.ip === this._options.host || ufo.ip === '0.0.0.0') {
        // Switch to command mode.
        this._send(Constants.command('helloAck'), function(err) {
          // Give up if we couldn't switch to command mode.
          // Otherwise fire the callback.
          if (err) this._socket.emit('error', err);
          else callback();
        });
      } else {
        this._socket.emit('error', new Error(`Received hello response from unexpected host: ${JSON.stringify(ufo)}`));
      }
    }
  }.bind(this));
}
// Sends the "AT+Q\r" message, ending command transmission and preparing for
// future commands to be sent.
//
// Callback is required and accepts no arguments.
Client.prototype._endCommand = function(callback) {
  if (this._dead) return;
  this._send(Constants.command('endCmd'), function(err) {
    if (err) this._socket.emit('error', err);
    else callback();
  }.bind(this));
}
// Sends the given message to the UFO and runs the callback once a response is received and verified.
// If the command fails or verification fails, the UFO object is disconnected with an error.
//
// Callback is required and accepts a message argument.
Client.prototype._sendAndRequire = function(cmd, expected, callback) {
  this._sendAndVerify(cmd, expected, function(err, resp, matches) {
    // Emit the receive error, or...
    // Emit an error if the response did not match, or...
    // Fire the callback with the response.
    if (err) {
      this._socket.emit('error', err);
    } else if (matches) {
      callback(resp);
    } else {
      this._socket.emit('error', new Error(`Unexpected response: ${resp}`));
    }
  }.bind(this));
}
// Sends the given message to the UFO and runs the callback once a response is received and verified.
// If the command fails or verification fails, the callback receives this information.
//
// Callback is required and accepts error, message and boolean "matches" arguments.
// Either the error or message argument is null, but never both.
// The "matches" argument is never null, and is always false if error is not null.
Client.prototype._sendAndVerify = function(cmd, expected, callback) {
  this._sendAndWait(cmd, function(err, resp) {
    var matches = false;
    if (!err) {
      if (Array.isArray(expected)) {
        matches = MiscUtils.arrayEquals(resp, expected);
      } else {
        matches = resp === expected;
      }
    }
    callback(err, resp, matches);
  }.bind(this));
}
// Sends the given message to the UFO and runs the callback once a response is received.
//
// Callback is required and accepts error and message arguments.
// Either one or the other argument is null, but never both.
Client.prototype._sendAndWait = function(cmd, callback) {
  this._receiveCallback = callback;
  this._receiveParser = cmd.recv;
  this._socket.send(cmd.send, Constants.port, this._options.host, function(err) {
    if (err) callback(err, null);
  });
}
// Sends the given message to the UFO and runs the callback once the message is sent.
// This method is suitable for commands that do not send responses.
//
// Callback is required and accepts an error argument.
Client.prototype._send = function(cmd, callback) {
  this._socket.send(cmd.send, Constants.port, this._options.host, callback);
}

/*
 * Core methods
 */
// Binds the UDP socket on this machine.
//
// Callback is required and accepts no arguments.
Client.prototype.connect = function(callback) {
  if (this._dead) return;
  var port = this._options.udpPort;
  if (port >= 0) {
    this._socket.bind(port, callback);
  } else {
    this._socket.bind(callback);
  }
}
// Closes the UDP socket on this machine.
Client.prototype.disconnect = function() {
  if (this._dead) return;
  // We're intentionally closing this connection.
  // Don't allow it to be used again.
  this._dead = true;
  this._socket.close();
}

/*
 * Core methods
 */
// Returns the version of the module.
//
// Callback is required and accepts error and version arguments.
// Either one or the other argument is null, but never both.
Client.prototype.version = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('moduleVersion'), function(err, version) {
      this._endCommand(function(err, version) {
        this(err, version);
      }.bind(callback, err, version));
    }.bind(this));
  }.bind(this));
}
// Reboots the UFO. This method invalidates the owning UFO object.
//
// Callback is optional and overrides any already-defined disconnect callback.
Client.prototype.reboot = function(callback) {
  // Override the callback if requested.
  if (typeof callback === 'function') this._ufo._disconnectCallback = callback;
  // Reboot and disconnect.
  this._commandMode(function() {
    this._send(Constants.command('reboot'), function(err) {
      if (err) this._socket.emit('error', err);
      else this._ufo.disconnect();
    }.bind(this));
  }.bind(this));
}
// Resets the UFO to factory defaults. This method invalidates the owning UFO object.
//
// Callback is optional and overrides any already-defined disconnect callback.
Client.prototype.factoryReset = function(callback) {
  // Override the callback if requested.
  if (typeof callback === 'function') this._ufo._disconnectCallback = callback;
  // Request a factory reset.
  // This command implies a reboot, so no explicit reboot command is needed.
  this._commandMode(function() {
    const cmd = Constants.command('factoryReset');
    const expected = Constants.commands.factoryReset.get;
    this._sendAndRequire(cmd, expected, function(msg) {
      this._ufo.disconnect();
    }.bind(this));
  }.bind(this));
}
// Returns the NTP server used to obtain the current time.
//
// Callback is required and accepts error and IP address arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getNtp = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('ntp'), function(err, ipAddress) {
      this._endCommand(function(err, ipAddress) {
        this(err, ipAddress);
      }.bind(callback, err, ipAddress));
    }.bind(this));
  }.bind(this));
}
// Sets the NTP server used to obtain the current time.
//
// Callback is optional and accepts an error argument.
Client.prototype.setNtp = function(ipAddress, callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('ntp', ipAddress), function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
// Returns the UDP password.
//
// Callback is required and accepts error and password arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getUdpPassword = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('udpPassword'), function(err, password) {
      this._endCommand(function(err, password) {
        this(err, password);
      }.bind(callback, err, password));
    }.bind(this));
  }.bind(this));
}
// Sets the UDP password.
//
// Callback is optional and accepts an error argument.
Client.prototype.setUdpPassword = function(password, callback) {
  if (password.length > 20) {
    callback(new Error(`Password is ${password.length} characters long, exceeding limit of 20.`));
    return;
  }
  this._commandMode(function() {
    this._sendAndWait(Constants.command('udpPassword', password), function(err) {
      // TODO update UFO object
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
// Returns the TCP port where RGBW commands are sent.
//
// Callback is required and accepts error and port arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getTcpPort = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('tcpServer'), function(err, tcpServer) {
      this._endCommand(function(err, port) {
        this(err, port);
      }.bind(callback, err, tcpServer[2]));
    }.bind(this));
  }.bind(this));
}
// Sets the TCP port where RGBW commands are sent.
//
// Callback is optional and accepts an error argument.
Client.prototype.setTcpPort = function(port, callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('tcpServer'), function(err, tcpServer) {
      if (err) callback(err);
      else this._sendAndWait(Constants.command('tcpServer', tcpServer[0], tcpServer[1], port, tcpServer[3]), function(err) {
        this._endCommand(function(err) { this(err); }.bind(callback, err));
      }.bind(this));
    }.bind(this));
  }.bind(this));
}
// Returns the WiFi "auto-switch" setting.
//
// Callback is required and accepts error and value arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiAutoSwitch = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiAutoSwitch'), function(err, value) {
      this._endCommand(function(err, value) {
        this(err, value);
      }.bind(callback, err, value));
    }.bind(this));
  }.bind(this));
}
// Sets the WiFi "auto-switch" setting.
//
// Callback is optional and accepts an error argument.
Client.prototype.setWifiAutoSwitch = function(value, callback) {
  var error = false;
  var intValue = parseInt(value);
  if (isNaN(intValue)) {
    switch (value) {
      case "off":
      case "on":
      case "auto":
        break;
      default:
        error = true;
        break;
    }
  } else {
    error = intValue < 3 || intValue > 120;
  }
  if (error) {
    callback(new Error(`Invalid value ${value}, must be "off", "on", "auto" or 3-120 inclusive.`));
    return;
  }
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiAutoSwitch', value), function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
// Returns the WiFi mode.
//
// Callback is required and accepts error and mode arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiMode = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiMode'), function(err, mode) {
      this._endCommand(function(err, mode) {
        this(err, mode);
      }.bind(callback, err, mode));
    }.bind(this));
  }.bind(this));
}
// Sets the WiFi mode.
//
// Callback is optional and accepts an error argument.
Client.prototype.setWifiMode = function(mode, callback) {
  switch (value) {
    case "AP":
    case "STA":
    case "APSTA":
      break;
    default:
      callback(new Error(`Invalid mode ${mode}, must be "AP", "STA" or "APSTA".`));
      return;
  }
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiMode', mode), function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}

/*
 * Client WiFi methods
 */
// Set the UFO in WiFi client mode and configures connection parameters.
//
// Callback is optional and has no arguments.
Client.prototype.asWifiClient = function(options, callback) {
  // Switch to command mode.
  this._commandMode(function() {
    // Parse options.
    const auth = MiscUtils.checkWithDefault(options.auth, ['OPEN', 'SHARED', 'WPAPSK', 'WPA2PSK'], 'OPEN');
    switch (auth) {
      case 'WPAPSK':
      case 'WPA2PSK':
        var encryption = MiscUtils.checkWithDefault(options.encryption, ['TKIP', 'AES'], 'AES');
        break;
      case 'SHARED':
        var encryption = MiscUtils.checkWithDefault(options.encryption, ['WEP-H', 'WEP-A'], 'WEP-A');
        break;
      default: // OPEN
        var encryption = MiscUtils.checkWithDefault(options.encryption, ['NONE', 'WEP-H', 'WEP-A'], 'NONE');
        break;
    }
    // Assemble the final options object.
    const finalOptions = {
      ssid: options.ssid,
      auth: auth,
      encryption: encryption,
      passphrase: options.passphrase
    }
    // Set the SSID.
    const ssidCmd = Constants.command('wifiClientSsid', finalOptions.ssid);
    this._sendAndRequire(ssidCmd, '', function(finalOptions, msg) {
      // Set the passphrase/auth configuration.
      const authCmd = Constants.command('wifiClientAuth', finalOptions.auth, finalOptions.encryption, finalOptions.passphrase);
      this._sendAndRequire(authCmd, '', function(msg) {
        // Set the UFO to client (STA) mode.
        const modeCmd = Constants.command('wifiMode', 'STA');
        this._sendAndRequire(modeCmd, '', function(msg) {
          // End the command and fire the callback.
          this._endCommand(callback);
        }.bind(this));
      }.bind(this));
    }.bind(this, finalOptions));
  }.bind(this));
}
