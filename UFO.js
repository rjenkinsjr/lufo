// require() specific to this module.
// https://gist.github.com/branneman/8048520#7-the-wrapper
global.lufoRequire = function(name) {
  return require(__dirname + '/' + name);
}

const events = require('events');
const TcpClient = lufoRequire('tcp/Client');
const UdpClient = lufoRequire('udp/Client');
const UFOError = lufoRequire('misc/UFOError');

/*
 * Constructor
 */
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
    this._tcpError = err;
    if (this._udpClient._dead) {
      this.emit('dead');
    } else {
      this._udpClient.disconnect();
    }
  }.bind(this));
  this._udpError = null;
  this.on('udpDead', function(err) {
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
      error = new UFOError("UFO disconnected due to an error.", this._udpError, this._tcpError);
    }
    var callback = this._disconnectCallback;
    typeof callback === 'function' && callback(error);
  }.bind(this));
  // Connect now, if a callback was requested.
  typeof callback === 'function' && this.connect(callback);
};
UFO.prototype = new events.EventEmitter;

/*
 * Query methods
 */
UFO.discover = UdpClient.discover;
UFO.prototype.getHost = function() {
  return this._options.host;
}
/*
 * Connect/disconnect methods
 */
UFO.prototype.connect = function(callback) {
  this._udpClient.hello(function() {
    this._tcpClient.connect(callback);
  }.bind(this));
}
UFO.prototype.disconnect = function() {
  this._dead = true;
  this._tcpClient.disconnect();
  this._udpClient.disconnect();
}
/*
 * Status/power methods
 */
UFO.prototype.getStatus = function(callback) {
  this._tcpClient.status(callback);
}
UFO.prototype.setPower = function(onOff, callback) {
  onOff ? this.turnOn(callback) : this.turnOff(callback);
}
/*
 * RGBW control methods
 */
UFO.prototype.turnOn = function(callback) {
  this._tcpClient.on(callback);
}
UFO.prototype.turnOff = function(callback) {
  this._tcpClient.off(callback);
}
UFO.prototype.setColor = function(red, green, blue, white, callback) {
  this._tcpClient.rgbw(red, green, blue, white, callback);
}
UFO.prototype.setBuiltin = function(name, speed, callback) {
  this._tcpClient.builtin(name, speed, callback);
}
UFO.prototype.setCustom = function(speed, mode, steps, callback) {
  this._tcpClient.custom(speed, mode, steps, callback);
}
UFO.prototype.freezeOutput = function(callback) {
  this.setBuiltin('noFunction', 0, callback);
}
UFO.prototype.zeroOutput = function(callback) {
  this.setColor(0, 0, 0, 0, callback);
}

/*
 * Reconfiguration methods
 */
UFO.prototype.factoryReset = function(callback) {
  this._tcpClient._time(function() {
    this._udpClient.factoryReset(callback);
  }.bind(this));
}
UFO.prototype.asWifiClient = function(options, callback) {
  this._tcpClient._time(function() {
    this._udpClient.asWifiClient(options, callback);
  }.bind(this));
}