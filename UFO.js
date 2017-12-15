const UFO_TCP = require('./tcp/UFO_TCP.js');
const UFO_UDP = require('./udp/UFO_UDP.js');

/*
 * Constructor
 */
var UFO = module.exports = function(options, callback) {
  // Capture the options provided by the user.
  this._options = Object.freeze(options);
  // Create the TCP and UDP sockets.
  this._tcpSocket = new UFO_TCP(options);
  // Connect now, if a callback was requested.
  typeof callback === 'function' && this.connect(callback);
};

/*
 * Query methods
 */
UFO.discover = UFO_UDP.discover;
UFO.prototype.getHost = function() {
  return this._options.host;
}
/*
 * Connect/disconnect methods
 */
UFO.prototype.connect = function(callback) {
  this._tcpSocket.connect(callback);
  // TODO udp
}
UFO.prototype.disconnect = function() {
  this._tcpSocket.disconnect();
  // TODO udp
}
/*
 * Status/power methods
 */
UFO.prototype.getStatus = function(callback) {
  this._tcpSocket.status(callback);
}
UFO.prototype.setPower = function(onOff, callback) {
  onOff ? this.turnOn(callback) : this.turnOff(callback);
}
/*
 * RGBW control methods
 */
UFO.prototype.turnOn = function(callback) {
  this._tcpSocket.on(callback);
}
UFO.prototype.turnOff = function(callback) {
  this._tcpSocket.off(callback);
}
UFO.prototype.setColor = function(red, green, blue, white, callback) {
  this._tcpSocket.rgbw(red, green, blue, white, callback);
}
UFO.prototype.setBuiltin = function(name, speed, callback) {
  this._tcpSocket.builtin(name, speed, callback);
}
UFO.prototype.setCustom = function(speed, mode, steps, callback) {
  this._tcpSocket.custom(speed, mode, steps, callback);
}
UFO.prototype.freezeOutput = function(callback) {
  this.setBuiltin('noFunction', 0, callback);
}
UFO.prototype.zeroOutput = function(callback) {
  this.setColor(0, 0, 0, 0, callback);
}
