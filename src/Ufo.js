const events = require('events');
const TcpClient = require('./TcpClient');
const UdpClient = require('./UdpClient');
const UfoDisconnectError = require('./UfoDisconnectError');

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
const Ufo = module.exports = function (options, callback) {
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
  this.on('tcpDead', (err) => {
    this._dead = true;
    this._tcpError = err;
    if (this._udpClient._dead) {
      this.emit('dead');
    } else {
      this._udpClient.disconnect();
    }
  });
  this._udpError = null;
  this.on('udpDead', (err) => {
    this._dead = true;
    this._udpError = err;
    if (this._tcpClient._dead) {
      this.emit('dead');
    } else {
      this._tcpClient.disconnect();
    }
  });
  // Define the "UFO is dead" event handler, invoked once both clients are closed.
  this.on('dead', () => {
    // Invoke the disconnect callback, if one is defined.
    let error = null;
    if (this._udpError || this._tcpError) {
      error = new UfoDisconnectError('UFO disconnected due to an error.', this._udpError, this._tcpError);
    }
    const callback = this._disconnectCallback;
    typeof callback === 'function' && callback(error);
  });
  // Make sure this UFO disconnects before NodeJS exits.
  process.on('exit', (code) => { this.disconnect(); });
  // Connect now, if a callback was requested.
  typeof callback === 'function' && this.connect(callback);
};
Ufo.prototype = new events.EventEmitter();

/*
 * Connect/disconnect methods
 */
Ufo.prototype.connect = function (callback) {
  this._udpClient.connect(() => {
    this._tcpClient.connect(callback);
  });
};
Ufo.prototype.disconnect = function () {
  if (this._dead) return;
  this._dead = true;
  this._tcpClient.disconnect();
  this._udpClient.disconnect();
};

/*
 * Query methods
 */
Ufo.discover = UdpClient.discover;
Ufo.prototype.getHost = function () {
  return this._options.host;
};
Ufo.prototype.getStatus = function (callback) {
  this._tcpClient.status(callback);
};
Ufo.prototype.getVersion = function (callback) {
  this._udpClient.version(callback);
};
Ufo.prototype.getNtpServer = function (callback) {
  this._udpClient.getNtpServer(callback);
};
Ufo.prototype.getUdpPassword = function (callback) {
  this._udpClient.getUdpPassword(callback);
};
Ufo.prototype.getTcpPort = function (callback) {
  this._udpClient.getTcpPort(callback);
};
Ufo.prototype.getWifiAutoSwitch = function (callback) {
  this._udpClient.getWifiAutoSwitch(callback);
};
Ufo.prototype.getWifiMode = function (callback) {
  this._udpClient.getWifiMode(callback);
};
Ufo.prototype.doWifiScan = function (callback) {
  this._udpClient.doWifiScan(callback);
};
Ufo.prototype.getWifiApIp = function (callback) {
  this._udpClient.getWifiApIp(callback);
};
Ufo.prototype.getWifiApBroadcast = function (callback) {
  this._udpClient.getWifiApBroadcast(callback);
};
Ufo.prototype.getWifiApPassphrase = function (callback) {
  this._udpClient.getWifiApPassphrase(callback);
};
Ufo.prototype.getWifiApLed = function (callback) {
  this._udpClient.getWifiApLed(callback);
};
Ufo.prototype.getWifiApDhcp = function (callback) {
  this._udpClient.getWifiApDhcp(callback);
};
Ufo.prototype.getWifiClientApInfo = function (callback) {
  this._udpClient.getWifiClientApInfo(callback);
};
Ufo.prototype.getWifiClientApSignal = function (callback) {
  this._udpClient.getWifiClientApSignal(callback);
};
Ufo.prototype.getWifiClientIp = function (callback) {
  this._udpClient.getWifiClientIp(callback);
};
Ufo.prototype.getWifiClientSsid = function (callback) {
  this._udpClient.getWifiClientSsid(callback);
};
Ufo.prototype.getWifiClientAuth = function (callback) {
  this._udpClient.getWifiClientAuth(callback);
};

/*
 * RGBW control methods
 */
Ufo.prototype.setPower = function (onOff, callback) {
  onOff ? this.turnOn(callback) : this.turnOff(callback);
};
Ufo.prototype.turnOn = function (callback) {
  this._tcpClient.on(callback);
};
Ufo.prototype.turnOff = function (callback) {
  this._tcpClient.off(callback);
};
Ufo.prototype.togglePower = function (callback) {
  this._tcpClient.togglePower(callback);
};
Ufo.prototype.setColor = function (red, green, blue, white, callback) {
  this._tcpClient.rgbw(red, green, blue, white, callback);
};
Ufo.prototype.setRed = function (value, solo, callback) {
  this._setSingle(0, value, solo, callback);
};
Ufo.prototype.setGreen = function (value, solo, callback) {
  this._setSingle(1, value, solo, callback);
};
Ufo.prototype.setBlue = function (value, solo, callback) {
  this._setSingle(2, value, solo, callback);
};
Ufo.prototype.setWhite = function (value, solo, callback) {
  this._setSingle(3, value, solo, callback);
};
Ufo.prototype._setSingle = function (position, value, solo, callback) {
  if (solo) {
    const values = [0, 0, 0, 0];
    values[position] = value;
    this.setColor(...values, callback);
  } else {
    this.getStatus((err, data) => {
      if (err) {
        callback(error);
      } else {
        const values = [data.red, data.green, data.blue, data.white];
        values[position] = value;
        this.setColor(...values, callback);
      }
    });
  }
};
Ufo.prototype.setBuiltin = function (name, speed, callback) {
  this._tcpClient.builtin(name, speed, callback);
};
Ufo.prototype.setCustom = function (mode, speed, steps, callback) {
  this._tcpClient.custom(mode, speed, steps, callback);
};
Ufo.prototype.freezeOutput = function (callback) {
  this.setBuiltin('noFunction', 0, callback);
};
Ufo.prototype.zeroOutput = function (callback) {
  this.setColor(0, 0, 0, 0, callback);
};

/*
 * Core reconfiguration methods
 */
// Reboots the UFO. This method invalidates the owning UFO object.
//
// Callback is optional and overrides any already-defined disconnect callback.
Ufo.prototype.reboot = function (callback) {
  this._udpClient.reboot(callback);
};
// Resets the UFO to factory defaults. This object can no longer be used after this method is called.
//
// Callback is optional and overrides any already-defined disconnect callback.
Ufo.prototype.factoryReset = function (callback) {
  this._tcpClient._time(() => {
    this._udpClient.factoryReset(callback);
  });
};
Ufo.prototype.setNtpServer = function (ipAddress, callback) {
  this._udpClient.setNtpServer(ipAddress, callback);
};
Ufo.prototype.setUdpPassword = function (password, callback) {
  this._udpClient.setUdpPassword(password, callback);
};
Ufo.prototype.setTcpPort = function (port, callback) {
  this._udpClient.setTcpPort(port, callback);
};
Ufo.prototype.setWifiAutoSwitch = function (value, callback) {
  this._udpClient.setWifiAutoSwitch(value, callback);
};
Ufo.prototype.setWifiMode = function (mode, callback) {
  this._udpClient.setWifiMode(mode, callback);
};

/*
 * WiFi AP reconfiguration methods
 */
Ufo.prototype.setWifiApIp = function (ip, mask, callback) {
  this._udpClient.setWifiApIp(ip, mask, callback);
};
Ufo.prototype.setWifiApBroadcast = function (mode, ssid, channel, callback) {
  this._udpClient.setWifiApBroadcast(mode, ssid, channel, callback);
};
Ufo.prototype.setWifiApPassphrase = function (passphrase, callback) {
  this._udpClient.setWifiApPassphrase(passphrase, callback);
};
Ufo.prototype.setWifiApLed = function (onOff, callback) {
  this._udpClient.setWifiApLed(onOff, callback);
};
Ufo.prototype.setWifiApDhcp = function (start, end, callback) {
  this._udpClient.setWifiApDhcp(start, end, callback);
};
Ufo.prototype.disableWifiApDhcp = function (callback) {
  this._udpClient.disableWifiApDhcp(callback);
};

/*
 * WiFi client reconfiguration methods
 */
Ufo.prototype.setWifiClientIpDhcp = function (callback) {
  this._udpClient.setWifiClientIpDhcp(callback);
};
Ufo.prototype.setWifiClientIpStatic = function (ip, mask, gateway, callback) {
  this._udpClient.setWifiClientIpStatic(ip, mask, gateway, callback);
};
Ufo.prototype.setWifiClientSsid = function (ssid, callback) {
  this._udpClient.setWifiClientSsid(ssid, callback);
};
Ufo.prototype.setWifiClientAuth = function (auth, encryption, passphrase, callback) {
  this._udpClient.setWifiClientAuth(auth, encryption, passphrase, callback);
};
