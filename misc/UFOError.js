module.exports = function UFOError(message, udpError, tcpError) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.udpError = udpError;
  this.tcpError = tcpError;
};
require('util').inherits(module.exports, Error);
