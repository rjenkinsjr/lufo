const util = require('util');
const dgram = require('dgram');
const Constants = require('^udp/Constants');
const UDPUtils = require('^udp/Utils');
const _ = require('lodash');
const IPv4 = require('ip-address').Address4;

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
          var code = message.substring(message.indexOf('=') + 1).trim();
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
  this._sendAndWait(this._options.password || Constants.command('hello'), function(err, msg) {
    if (err) {
      // Give up if we couldn't say hello.
      if (err) this._socket.emit('error', err);
    } else {
      // Give up if the response did not come from the expected IP.
      var ufo = UDPUtils.parseHelloResponse(msg);
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
        matches = _.isEqual(resp, expected);
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
Client.prototype.getNtpServer = function(callback) {
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
Client.prototype.setNtpServer = function(ipAddress, callback) {
  if (!new IPv4(ipAddress).isValid()) {
    callback(new Error(`Invalid IP address provided: ${ipAddress}.`));
  }
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
// Callback is optional and overrides any already-defined disconnect callback.
Client.prototype.setUdpPassword = function(password, callback) {
  if (password.length > 20) {
    callback(new Error(`Password is ${password.length} characters long, exceeding limit of 20.`));
    return;
  }
  // Override the callback if requested.
  if (typeof callback === 'function') this._ufo._disconnectCallback = callback;
  this._commandMode(function() {
    this._sendAndWait(Constants.command('udpPassword', password), function(err) {
      if (err) this._socket.emit('error', err);
      else this._ufo.disconnect();
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
      }.bind(callback, err, parseInt(tcpServer[2])));
    }.bind(this));
  }.bind(this));
}
// Sets the TCP port where RGBW commands are sent.
//
// Callback is optional and overrides any already-defined disconnect callback.
Client.prototype.setTcpPort = function(port, callback) {
  var intPort = parseInt(port);
  var portError = isNaN(intPort);
  portError = portError || (intPort < 0 || intPort > 65535);
  if (portError) {
    callback(new Error(`Invalid port ${port}, must 0-65535 inclusive.`));
  }
  // Override the callback if requested.
  if (typeof callback === 'function') this._ufo._disconnectCallback = callback;
  this._commandMode(function() {
    this._sendAndWait(Constants.command('tcpServer'), function(err, tcpServer) {
      if (err) callback(err);
      else this._sendAndWait(Constants.command('tcpServer', tcpServer[0], tcpServer[1], port, tcpServer[3]), function(err) {
        if (err) this._socket.emit('error', err);
        else this._ufo.disconnect();
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
  switch (mode) {
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
// Performs a WiFi network scan and returns the results.
//
// Callback is required and accepts error and result arguments.
// Either one or the other argument is null, but never both.
Client.prototype.doWifiScan = function(callback) {
  var resultArray = [];
  var headerReceived = false;
  var errorReceived = false;
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiScan'), function(err, result) {
      if (!errorReceived) {
        if (err) {
          errorReceived = true;
          this._endCommand(function(err) {
            this(err, null);
          }.bind(callback, err));
        } else if (!headerReceived) {
          headerReceived = true;
        } else if (Array.isArray(result)) {
          // Each line in the output has a \n. It appears to be silently swallowed
          // by the receiver function, which is fine because we don't want it anyway.
          resultArray.push({
            channel: parseInt(result[0]),
            ssid: result[1] || null,
            mac: UDPUtils.macAddress(result[2]),
            security: result[3],
            strength: parseInt(result[4])
          })
        } else {
          this._endCommand(function(result) {
            this(null, result);
          }.bind(callback, resultArray));
        }
      }
    }.bind(this));
  }.bind(this));
}

/*
 * AP WiFi methods
 */
// Returns the IP address and netmask of the AP.
//
// Callback is required and accepts error and result arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiApIp = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiApIp'), function(err, result) {
      this._endCommand(function(err, result) {
        this(err, {
          ip: result[0],
          mask: result[1]
        });
      }.bind(callback, err, result));
    }.bind(this));
  }.bind(this));
}
// Sets the IP address and netmask of the AP.
//
// Callback is optional and accepts an error argument.
Client.prototype.setWifiApIp = function(ip, mask, callback) {
  if (!new IPv4(ip).isValid()) {
    callback(new Error(`Invalid IP address provided: ${ip}.`));
  }
  if (!new IPv4(mask).isValid()) {
    callback(new Error(`Invalid subnet mask provided: ${mask}.`));
  }
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiApIp', ip, mask), function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
// Returns the AP broadcast information.
//
// Callback is required and accepts error and result arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiApBroadcast = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiApBroadcast'), function(err, result) {
      this._endCommand(function(err, result) {
        var mode;
        switch (result[0]) {
          case '11b':
            mode = 'b';
            break;
          case '11bg':
            mode = 'bg';
            break;
          case '11bgn':
            mode = 'bgn';
            break;
          default:
            mode = 'unknown'
            break;
        }
        var ssid = result[1];
        var channel = parseInt(result[2].substring(2));
        this(err, {
          mode: mode,
          ssid: ssid,
          channel: channel
        });
      }.bind(callback, err, result));
    }.bind(this));
  }.bind(this));
}
// Sets the AP broadcast information.
//
// Callback is optional and accepts an error argument.
Client.prototype.setWifiApBroadcast = function(mode, ssid, channel, callback) {
  switch (mode) {
    case 'b':
    case 'bg':
    case 'bgn':
      break;
    default:
      callback(new Error(`Invalid mode ${mode}, must be "b", "bg" or "bgn".`));
      return;
  }
  if (ssid.length > 32) {
    callback(new Error(`SSID is ${ssid.length} characters long, exceeding limit of 32.`));
    return;
  }
  var intChannel = parseInt(channel);
  var channelError = isNaN(intChannel);
  channelError = channelError || (intChannel < 1 || intChannel > 11);
  if (channelError) {
    callback(new Error(`Invalid channel ${channel}, must be 1-11 inclusive.`));
    return;
  }
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiApBroadcast', `11${mode}`, ssid, `CH${channel}`), function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
// Returns the passphrase of the AP.
//
// Callback is required and accepts error and passphrase arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiApPassphrase = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiApAuth'), function(err, result) {
      this._endCommand(function(err, result) {
        this(err, result[0] === "OPEN" ? false : result[2]);
      }.bind(callback, err, result));
    }.bind(this));
  }.bind(this));
}
// Sets the passphrase of the AP.
//
// Callback is optional and accepts an error argument.
Client.prototype.setWifiApPassphrase = function(passphrase, callback) {
  var cmd;
  if (passphrase === false || passphrase === 'false') {
    cmd = Constants.command('wifiApAuth', 'OPEN', 'NONE');
  } else if (passphrase.length < 8 || passphrase.length > 63) {
    callback(new Error(`Passphrase is ${passphrase.length} characters long, must be 8-63 characters inclusive.`));
    return;
  } else {
    cmd = Constants.command('wifiApAuth', 'WPA2PSK', 'AES', passphrase);
  }
  this._commandMode(function() {
    this._sendAndWait(cmd, function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
// Returns the LED enable/disable flag of the AP.
//
// Callback is required and accepts error and onOff arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiApLed = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiApLed'), function(err, result) {
      this._endCommand(function(err, result) {
        this(err, result === 'on');
      }.bind(callback, err, result));
    }.bind(this));
  }.bind(this));
}
// Sets the LED enable/disable flag of the AP.
//
// Callback is optional and accepts an error argument.
Client.prototype.setWifiApLed = function(onOff, callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiApLed', onOff ? 'on' : 'off'), function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
// Returns the DHCP server settings of the AP.
//
// Callback is required and accepts error and result arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiApDhcp = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiApDhcp'), function(err, result) {
      this._endCommand(function(err, result) {
        var dhcp = { on: result[0] === 'on' }
        if (dhcp.on) {
          dhcp.start = parseInt(result[1]);
          dhcp.end = parseInt(result[2]);
        }
        this(err, dhcp);
      }.bind(callback, err, result));
    }.bind(this));
  }.bind(this));
}
// Sets the DHCP server settings of the AP.
//
// Callback is optional and accepts an error argument.
Client.prototype.setWifiApDhcp = function(start, end, callback) {
  var intStart = parseInt(start);
  var startError = isNaN(intStart);
  startError = startError || (intStart < 0 || intStart > 254);
  if (startError) {
    callback(new Error(`Invalid start octet ${start}, must be 0-254 inclusive.`));
    return;
  }
  var intEnd = parseInt(end);
  var endError = isNaN(intEnd);
  endError = endError || (intEnd < 0 || intEnd > 254);
  if (endError) {
    callback(new Error(`Invalid end octet ${end}, must be 0-254 inclusive.`));
    return;
  }
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiApDhcp', 'on', start, end), function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
// Disables the DHCP server of the AP.
//
// Callback is optional and accepts an error argument.
Client.prototype.disableWifiApDhcp = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiApDhcp', 'off'), function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}

/*
 * Client WiFi methods
 */
// Returns the client's AP info.
//
// Callback is required and accepts error and result arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiClientApInfo = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiClientApInfo'), function(err, result) {
      this._endCommand(function(err, result) {
        var info = {
          ssid: null,
          mac: null
        };
        if (result !== "Disconnected") {
          var match = result.match(/(.{1,32})\(([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})\)/i);
          info.ssid = match[1];
          info.mac = UDPUtils.macAddress(match[2]);
        }
        this(err, info);
      }.bind(callback, err, result));
    }.bind(this));
  }.bind(this));
}
// Returns the client's AP signal strength.
//
// Callback is required and accepts error and result arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiClientApSignal = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiClientApSignal'), function(err, result) {
      this._endCommand(function(err, result) {
        this(err, result === "Disconnected" ? false : result.join(','));
      }.bind(callback, err, result));
    }.bind(this));
  }.bind(this));
}
// Returns the client's IP settings.
//
// Callback is required and accepts error and result arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiClientIp = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiClientIp'), function(err, result) {
      this._endCommand(function(err, result) {
        this(err, {
          dhcp: result[0] === "DHCP",
          ip: result[1],
          mask: result[2],
          gateway: result[3]
        });
      }.bind(callback, err, result));
    }.bind(this));
  }.bind(this));
}
// Sets the client's IP settings to use DHCP.
//
// Callback is optional and accepts an error argument.
Client.prototype.setWifiClientIpDhcp = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiClientIp', 'DHCP'), function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
// Sets the client's IP settings to use static assignment.
//
// Callback is optional and accepts an error argument.
Client.prototype.setWifiClientIpStatic = function(ip, mask, gateway, callback) {
  if (!new IPv4(ip).isValid()) {
    callback(new Error(`Invalid IP address provided: ${ip}.`));
  }
  if (!new IPv4(mask).isValid()) {
    callback(new Error(`Invalid subnet mask provided: ${mask}.`));
  }
  if (!new IPv4(gateway).isValid()) {
    callback(new Error(`Invalid gateway provided: ${gateway}.`));
  }
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiClientIp', 'static', ip, mask, gateway), function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
// Returns the client's AP SSID.
//
// Callback is required and accepts error and SSID arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiClientSsid = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiClientSsid'), function(err, result) {
      this._endCommand(function(err, result) {
        this(err, result);
      }.bind(callback, err, result));
    }.bind(this));
  }.bind(this));
}
// Sets the client's AP SSID.
//
// Callback is optional and accepts an error argument.
Client.prototype.setWifiClientSsid = function(ssid, callback) {
  if (ssid.length > 32) {
    callback(new Error(`SSID is ${ssid.length} characters long, exceeding limit of 32.`));
    return;
  }
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiClientSsid', ssid), function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
// Returns the client's AP auth parameters.
//
// Callback is required and accepts error and result arguments.
// Either one or the other argument is null, but never both.
Client.prototype.getWifiClientAuth = function(callback) {
  this._commandMode(function() {
    this._sendAndWait(Constants.command('wifiClientAuth'), function(err, result) {
      this._endCommand(function(err, result) {
        this(err, {
          auth: result[0],
          encryption: result[1],
          passphrase: result[2] || null
        });
      }.bind(callback, err, result));
    }.bind(this));
  }.bind(this));
}
// Sets the client's AP auth parameters.
//
// Callback is optional and accepts an error argument.
Client.prototype.setWifiClientAuth = function(auth, encryption, passphrase, callback) {
  var cmd;
  if (auth === "OPEN") {
    switch (encryption) {
      case "NONE":
      case "WEP-H":
      case "WEP-A":
        break;
      case "TKIP":
      case "AES":
        callback(new Error(`Invocation error: auth is OPEN but unsupported encryption ${encryption} provided.`));
        return;
      default:
        callback(new Error(`Invocation error: no such encryption ${encryption}.`));
        return;
    }
  } else if (auth === "SHARED") {
    switch (encryption) {
      case "WEP-H":
      case "WEP-A":
        break;
      case "NONE":
      case "TKIP":
      case "AES":
        callback(new Error(`Invocation error: auth is SHARED but unsupported encryption ${encryption} provided.`));
        return;
      default:
        callback(new Error(`Invocation error: no such encryption ${encryption}.`));
        return;
    }
  } else if (auth === "WPAPSK" || auth === "WPA2PSK") {
    switch (encryption) {
      case "TKIP":
      case "AES":
        break;
      case "NONE":
      case "WEP-H":
      case "WEP-A":
        callback(new Error(`Invocation error: auth is SHARED but unsupported encryption ${encryption} provided.`));
        return;
      default:
        callback(new Error(`Invocation error: no such encryption ${encryption}.`));
        return;
    }
  } else {
    callback(new Error(`Invocation error: no such auth ${auth}.`));
    return;
  }
  if (encryption === "NONE" && passphrase !== null) {
    callback(new Error(`Invocation error: encryption is NONE but passphrase is not null.`));
    return;
  } else if (encryption === "WEP-H") {
    // TODO support WEP-H by validating/constructing passphrase correctly
    callback(new Error('Invocation error: WEP-H is not yet supported by this library.'));
    return;
  } else if (encryption === "WEP-A") {
    if (passphrase.length !== 5 && passphrase.length !== 13) {
      callback(new Error(`Invocation error: encryption is WEP-A but passphrase length is ${passphrase.length} characters and must be either 5 or 13 characters.`));
      return;
    }
  } else if (encryption === "TKIP" || encryption === "AES") {
    if (passphrase.length < 8 || passphrase.length > 63) {
      callback(new Error(`Invocation error: encryption is ${encryption} but passphrase length is ${passphrase.length} characters and must be 8-63 inclusive.`));
      return;
    }
  }
  var cmd;
  if (encryption === "NONE") {
    cmd = Constants.command('wifiClientAuth', 'OPEN', 'NONE');
  } else {
    cmd = Constants.command('wifiClientAuth', auth, encryption, passphrase);
  }
  this._commandMode(function() {
    this._sendAndWait(cmd, function(err) {
      this._endCommand(function(err) { this(err); }.bind(callback, err));
    }.bind(this));
  }.bind(this));
}
