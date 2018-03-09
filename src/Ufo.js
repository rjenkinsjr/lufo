global.lufoRequire = function(name) {
    return require(__dirname + '/' + name);
}
const events = require('events');
const TcpClient = lufoRequire('tcp/Client');
const UdpClient = lufoRequire('udp/Client');
const UfoDisconnectError = lufoRequire('UfoDisconnectError');

/*
 * Constructor
 */
/* Options object:
{
  // required IP address of the UFO
  host: '192.168.1.10',
  // optional UDP password; if not specified, the default is used
  password: 'blah'
  // optional local UDP port number; if not specified or non-positive, a random port is used
  udpPort: 0,
  // optional local TCP port number; if not specified or non-positive, a random port is used
  tcpPort: 0,
  // true (default) or false, tells the TCP socket (RGBW control) whether to send data right away or buffer
  sendImmediately: true,
  // optional callback w/ error argument invoked when this UFO object disconnects from its host
  disconnectCallback: function(err) {}
}
*/
// If the optional callback is provided, the UFO object's connect() method will
// be invoked immediately after construction. The callback takes no arguments.
var UFO = module.exports = function(options, callback) {
  // Flag that tracks the state of this UFO object.
  this._dead = false;
  // Capture the options provided by the user.
  this._options = Object.freeze(options);
  this._disconnectCallback = this._options.disconnectCallback;
  // Create the TCP and UDP clients.
  this._tcpClient = new TcpClient(this, options);
  this._udpClient = new UdpClient(this, options);
  // Define the "client is dead" event handlers.
  this._tcpError = null;
  this.on('tcpDead', function(err) {
    this._dead = true;
    this._tcpError = err;
    if (this._udpClient._dead) {
      this.emit('dead');
    } else {
      this._udpClient.disconnect();
    }
  }.bind(this));
  this._udpError = null;
  this.on('udpDead', function(err) {
    this._dead = true;
    this._udpError = err;
    if (this._tcpClient._dead) {
      this.emit('dead');
    } else {
      this._tcpClient.disconnect();
    }
  }.bind(this))
  // Define the "UFO is dead" event handler, invoked once both clients are closed.
  this.on('dead', function() {
    // Invoke the disconnect callback, if one is defined.
    var error = null;
    if (this._udpError || this._tcpError) {
      error = new UfoDisconnectError("UFO disconnected due to an error.", this._udpError, this._tcpError);
    }
    var callback = this._disconnectCallback;
    typeof callback === 'function' && callback(error);
  }.bind(this));
  // Make sure this UFO disconnects before NodeJS exits.
  process.on('exit', function(code) { this.disconnect(); }.bind(this));
  // Connect now, if a callback was requested.
  typeof callback === 'function' && this.connect(callback);
};
UFO.prototype = new events.EventEmitter;

/*
 * Connect/disconnect methods
 */
UFO.prototype.connect = function(callback) {
  this._udpClient.connect(function() {
    this._tcpClient.connect(callback);
  }.bind(this));
}
UFO.prototype.disconnect = function() {
  if (this._dead) return;
  this._dead = true;
  this._tcpClient.disconnect();
  this._udpClient.disconnect();
}

/*
 * Query methods
 */
UFO.discover = UdpClient.discover;
UFO.prototype.getHost = function() {
  return this._options.host;
}
UFO.prototype.getStatus = function(callback) {
  this._tcpClient.status(callback);
}
UFO.prototype.getVersion = function(callback) {
  this._udpClient.version(callback);
}
UFO.prototype.getNtpServer = function(callback) {
  this._udpClient.getNtpServer(callback);
}
UFO.prototype.getUdpPassword = function(callback) {
  this._udpClient.getUdpPassword(callback);
}
UFO.prototype.getTcpPort = function(callback) {
  this._udpClient.getTcpPort(callback);
}
UFO.prototype.getWifiAutoSwitch = function(callback) {
  this._udpClient.getWifiAutoSwitch(callback);
}
UFO.prototype.getWifiMode = function(callback) {
  this._udpClient.getWifiMode(callback);
}
UFO.prototype.doWifiScan = function(callback) {
  this._udpClient.doWifiScan(callback);
}
UFO.prototype.getWifiApIp = function(callback) {
  this._udpClient.getWifiApIp(callback);
}
UFO.prototype.getWifiApBroadcast = function(callback) {
  this._udpClient.getWifiApBroadcast(callback);
}
UFO.prototype.getWifiApPassphrase = function(callback) {
  this._udpClient.getWifiApPassphrase(callback);
}
UFO.prototype.getWifiApLed = function(callback) {
  this._udpClient.getWifiApLed(callback);
}
UFO.prototype.getWifiApDhcp = function(callback) {
  this._udpClient.getWifiApDhcp(callback);
}
UFO.prototype.getWifiClientApInfo = function(callback) {
  this._udpClient.getWifiClientApInfo(callback);
}
UFO.prototype.getWifiClientApSignal = function(callback) {
  this._udpClient.getWifiClientApSignal(callback);
}
UFO.prototype.getWifiClientIp = function(callback) {
  this._udpClient.getWifiClientIp(callback);
}
UFO.prototype.getWifiClientSsid = function(callback) {
  this._udpClient.getWifiClientSsid(callback);
}
UFO.prototype.getWifiClientAuth = function(callback) {
  this._udpClient.getWifiClientAuth(callback);
}

/*
 * RGBW control methods
 */
UFO.prototype.setPower = function(onOff, callback) {
  onOff ? this.turnOn(callback) : this.turnOff(callback);
}
UFO.prototype.turnOn = function(callback) {
  this._tcpClient.on(callback);
}
UFO.prototype.turnOff = function(callback) {
  this._tcpClient.off(callback);
}
UFO.prototype.togglePower = function(callback) {
  this._tcpClient.togglePower(callback);
}
UFO.prototype.setColor = function(red, green, blue, white, callback) {
  this._tcpClient.rgbw(red, green, blue, white, callback);
}
UFO.prototype.setRed = function(value, solo, callback) {
  this._setSingle(0, value, solo, callback);
}
UFO.prototype.setGreen = function(value, solo, callback) {
  this._setSingle(1, value, solo, callback);
}
UFO.prototype.setBlue = function(value, solo, callback) {
  this._setSingle(2, value, solo, callback);
}
UFO.prototype.setWhite = function(value, solo, callback) {
  this._setSingle(3, value, solo, callback);
}
UFO.prototype._setSingle = function(position, value, solo, callback) {
  if (solo) {
    var values = [0, 0, 0, 0];
    values[position] = value;
    this.setColor(...values, callback);
  } else {
    this.getStatus(function(err, data) {
      if (err) {
        callback(error);
      } else {
        var values = [data.red, data.green, data.blue, data.white];
        values[position] = value;
        this.setColor(...values, callback);
      }
    }.bind(this));
  }
}
UFO.prototype.setBuiltin = function(name, speed, callback) {
  this._tcpClient.builtin(name, speed, callback);
}
UFO.prototype.setCustom = function(mode, speed, steps, callback) {
  this._tcpClient.custom(mode, speed, steps, callback);
}
UFO.prototype.freezeOutput = function(callback) {
  this.setBuiltin('noFunction', 0, callback);
}
UFO.prototype.zeroOutput = function(callback) {
  this.setColor(0, 0, 0, 0, callback);
}

/*
 * Core reconfiguration methods
 */
// Reboots the UFO. This method invalidates the owning UFO object.
//
// Callback is optional and overrides any already-defined disconnect callback.
UFO.prototype.reboot = function(callback) {
  this._udpClient.reboot(callback);
}
// Resets the UFO to factory defaults. This object can no longer be used after this method is called.
//
// Callback is optional and overrides any already-defined disconnect callback.
UFO.prototype.factoryReset = function(callback) {
  this._tcpClient._time(function() {
    this._udpClient.factoryReset(callback);
  }.bind(this));
}
UFO.prototype.setNtpServer = function(ipAddress, callback) {
  this._udpClient.setNtpServer(ipAddress, callback);
}
UFO.prototype.setUdpPassword = function(password, callback) {
  this._udpClient.setUdpPassword(password, callback);
}
UFO.prototype.setTcpPort = function(port, callback) {
  this._udpClient.setTcpPort(port, callback);
}
UFO.prototype.setWifiAutoSwitch = function(value, callback) {
  this._udpClient.setWifiAutoSwitch(value, callback);
}
UFO.prototype.setWifiMode = function(mode, callback) {
  this._udpClient.setWifiMode(mode, callback);
}

/*
 * WiFi AP reconfiguration methods
 */
UFO.prototype.setWifiApIp = function(ip, mask, callback) {
  this._udpClient.setWifiApIp(ip, mask, callback);
}
UFO.prototype.setWifiApBroadcast = function(mode, ssid, channel, callback) {
  this._udpClient.setWifiApBroadcast(mode, ssid, channel, callback);
}
UFO.prototype.setWifiApPassphrase = function(passphrase, callback) {
  this._udpClient.setWifiApPassphrase(passphrase, callback);
}
UFO.prototype.setWifiApLed = function(onOff, callback) {
  this._udpClient.setWifiApLed(onOff, callback);
}
UFO.prototype.setWifiApDhcp = function(start, end, callback) {
  this._udpClient.setWifiApDhcp(start, end, callback);
}
UFO.prototype.disableWifiApDhcp = function(callback) {
  this._udpClient.disableWifiApDhcp(callback);
}

/*
 * WiFi client reconfiguration methods
 */
UFO.prototype.setWifiClientIpDhcp = function(callback) {
  this._udpClient.setWifiClientIpDhcp(callback);
}
UFO.prototype.setWifiClientIpStatic = function(ip, mask, gateway, callback) {
  this._udpClient.setWifiClientIpStatic(ip, mask, gateway, callback);
}
UFO.prototype.setWifiClientSsid = function(ssid, callback) {
  this._udpClient.setWifiClientSsid(ssid, callback);
}
UFO.prototype.setWifiClientAuth = function(auth, encryption, passphrase, callback) {
  this._udpClient.setWifiClientAuth(auth, encryption, passphrase, callback);
}
