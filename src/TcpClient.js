const net = require('net');
const Builtins = require('./TcpBuiltins');
const Customs = require('./TcpCustoms');
const Power = require('./TcpPower');
const Status = require('./TcpStatus');
const TCPUtils = require('./TcpUtils');

// TCP socket creation method. Must be bound to a tcp/Client instance.
const createSocket = function() {
  // UFOs will close TCP connections after a cetain time of not receiving any data.
  // TCP keepalives from Node don't seem to help.
  // This flag is used by the "close" event handler to re-establish a connection
  // that was unknowingly closed by the UFO.
  //
  // If this is true, this UFO instance is unusable and will no longer perform
  // any UFO control methods (e.g. rgbw).
  this._dead = false;
  // Storage/tracking for the status response.
  this._statusArray = new Uint8Array(Status.getResponseSize());
  this._statusIndex = 0;
  // The TCP socket used to communicate with the UFO.
  this._socket = net.Socket();
  this._error = null;
  // Send all data immediately; no buffering.
  this._socket.setNoDelay(this._options.sendImmediately || true);
  // Capture errors so we can respond appropriately.
  this._socket.on('error', function(err) {
    // Do NOT set the dead flag here! The close handler needs its current status.
    this._error = err;
    // NodeJS automatically emits a "close" event after an "error" event.
  }.bind(this));
  // Both sides have FIN'ed. No more communication is allowed on this socket.
  this._socket.on('close', closeSocket.bind(this));
  // Any TCP data received from the UFO is a status update.
  this._socket.on('data', Status.getResponseHandler(this));
  // Initially, ignore all received data.
  this._socket.pause();
}

// TCP socket close event handler. Must be bound to a tcp/Client instance.
//
// If the UFO FIN'ed first due to inactivity, silently reconnect.
// If the UFO FIN'ed first due to an error, fire the disconnect callback with the error.
// Otherwise, fire the disconnect callback with no error.
const closeSocket = function() {
  // Assume the UFO closed on its own.
  // Otherwise, the socket closed intentionally and no error has occurred.
  var reconnect = !this._dead;
  var err = null;
  if (reconnect) {
    // The UFO closed on its own.
    // If it closed due to an error, do not reconnect.
    err = this._error;
    if (err) reconnect = false;
  }
  // Tear down the socket.
  this._socket.unref();
  this._socket.destroy();
  // Reconnect if necessary, or fire the disconnect callback.
  if (reconnect) {
    createSocket.call(this);
    this.connect();
  } else {
    // Mark this client as dead and notify the UFO object.
    this._dead = true;
    this._ufo.emit('tcpDead', this._error);
  }
}

/*
 * Exports
 */

var Client = module.exports = function(ufo, options) {
  // Capture the parent UFO.
  this._ufo = ufo;
  // Capture the options provided by the user.
  this._options = Object.freeze(options);
  // Create the TCP socket and other dependent objects.
  createSocket.call(this);
};

/*
 * Private methods
 */
// Wraps the socket.write() method, handling the optional callback.
//
// callback is optional and accepts no arguments.
Client.prototype._write = function(buffer, callback) {
  if (typeof callback === 'function') {
    this._socket.write(buffer, callback);
  } else {
    this._socket.write(buffer);
  }
}
// This function appears to set the UFO's time.
// It is called by the Android app when a UFO is factory reset or has its WiFi configuration is updated.
// Neither of those functions seem dependent on this function executing, however...correctly or at all.
//
// Since this function's purpose isn't fully known, it is marked as private.
// Its response always seems to be 0x0f 0x10 0x00 0x1f.
//
// Callback is optional and accepts no arguments.
Client.prototype._time = function(callback) {
  if (this._dead) return;
  // 0x10 yy yy mm dd hh mm ss 0x07 0x00
  // The first "yy" is the first 2 digits of the year.
  // The second "yy" is the last 2 digits of the year.
  // "mm" ranges from decimal "01" to "12".
  // "hh" is 24-hour format.
  // 0x07 0x00 seems to be a constant terminator for the data.
  var buf = Buffer.alloc(10);
  buf.writeUInt8(0x10, 0);
  var now = new Date();
  var first2Year = parseInt(now.getFullYear().toString().substring(0, 2));
  var last2Year = parseInt(now.getFullYear().toString().substring(2));
  buf.writeUInt8(first2Year, 1);
  buf.writeUInt8(last2Year, 2);
  buf.writeUInt8(now.getMonth() + 1, 3);
  buf.writeUInt8(now.getDate(), 4);
  buf.writeUInt8(now.getHours(), 5);
  buf.writeUInt8(now.getMinutes(), 6);
  buf.writeUInt8(now.getSeconds(), 7);
  buf.writeUInt8(0x07, 8);
  buf.writeUInt8(0, 9);
  this._write(TCPUtils.prepareBytes(buf), callback);
}


/*
 * Core methods
 */
// Binds the TCP socket on this machine.
//
// Callback is required and accepts no arguments.
Client.prototype.connect = function(callback) {
  if (this._dead) return;
  // Define options object.
  var options = {
    host: this._options.host,
    // All UFOs listen on the same port.
    port: 5577
  };
  if (this._options.tcpPort && this._options.tcpPort > 0) {
    options.localPort = this._options.tcpPort;
  }
  // Connect.
  this._socket.connect(options, callback);
}
// Closes the TCP socket on this machine.
Client.prototype.disconnect = function() {
  if (this._dead) return;
  // We're intentionally closing this connection.
  // Don't allow it to be used again.
  this._dead = true;
  this._socket.end();
  this._socket.emit('close');
}
// Returns a JSON object describing the status of the UFO.
//
// Callback is required and accepts error and data arguments.
// Either one or the other argument is null, but never both.
Client.prototype.status = function(callback) {
  if (this._dead) return;
  this._socket.resume();
  this._statusCallback = function(err, data) {
    this._statusCallback = null;
    this._socket.pause();
    callback(err, data);
  }.bind(this);
  this._socket.write(Status.getRequest());
}
// Turns the UFO on.
//
// Callback is optional and accepts no arguments.
Client.prototype.on = function(callback) {
  if (this._dead) return;
  this._write(Power.on(), callback);
}
// Turns the UFO off.
//
// Callback is optional and accepts no arguments.
Client.prototype.off = function(callback) {
  if (this._dead) return;
  this._write(Power.off(), callback);
}
// Toggles the UFO.
//
// Callback is optional and accepts an error argument.
Client.prototype.togglePower = function(callback) {
  if (this._dead) return;
  this.status(function(err, status) {
    if (err) {
      typeof callback === 'function' && callback(err);
    } else if (status.power === 'on') {
      this.off(callback);
    } else {
      this.on(callback);
    }
  }.bind(this));
}

/*
 * Standard control methods
 */
// Sets the RGBW output values of the UFO.
//
// Callback is optional and accepts no arguments.
Client.prototype.rgbw = function(red, green, blue, white, callback) {
  if (this._dead) return;
  // 0x31 rr gg bb ww 0x00
  // 0x00 seems to be a constant terminator for the data.
  var buf = Buffer.alloc(6);
  buf.writeUInt8(0x31, 0);
  buf.writeUInt8(TCPUtils.clampRGBW(red), 1);
  buf.writeUInt8(TCPUtils.clampRGBW(green), 2);
  buf.writeUInt8(TCPUtils.clampRGBW(blue), 3);
  buf.writeUInt8(TCPUtils.clampRGBW(white), 4);
  buf.writeUInt8(0, 5);
  this._write(TCPUtils.prepareBytes(buf), callback);
}
// Enables one of the UFO's built-in functions.
// Speed ranges from 0 (slow) to 100 (fast), inclusive.
//
// Callback is optional and accepts no arguments.
Client.prototype.builtin = function(name, speed, callback) {
  if (this._dead) return;
  // 0x61 id speed
  var buf = Buffer.alloc(3);
  buf.writeUInt8(0x61, 0);
  buf.writeUInt8(Builtins.getFunctionId(name), 1);
  // This function accepts a speed from 0 (slow) to 100 (fast).
  buf.writeUInt8(Builtins.flipSpeed(speed), 2);
  this._write(TCPUtils.prepareBytes(buf), callback);
}
// Starts a custom function.
// Speed ranges from 0 (slow) to 30 (fast).
// Mode is one of 'gradual', 'jumping' or 'strobe'.
//
// Steps is an array of objects; each object must define 'red', 'green' and 'blue' attributes whose values range from 0 to 255, inclusive.
// The array should not be more than 16 objects in size; only the first 16 objects will be used.
// Step objects defined as { red: 1, green: 2, blue: 3 } are invalid and dropped from the input array.
//
// Callback is optional and accepts no arguments.
Client.prototype.custom = function(mode, speed, steps, callback) {
  if (this._dead) return;
  // Validate the mode.
  var modeId;
  switch (mode) {
    case 'gradual':
      modeId = 0x3A;
      break;
    case 'jumping':
      modeId = 0x3B;
      break;
    case 'strobe':
      modeId = 0x3C;
      break;
    default:
      typeof callback === 'function' && callback(new Error(`Invalid mode '${mode}'.`));
      return;
  }
  // 0x51 steps(16xUInt8) speed mode 0xFF
  // 0xFF seems to be a constant terminator for the data.
  var buf = Buffer.alloc(68);
  buf.writeUInt8(0x51, 0);
  var index = 1;
  // If there are fewer than 16 steps, "null" steps must be added so we have
  // exactly 16 steps. Additionally, any null steps intermingled with non-null
  // steps must be removed, as they will cause the pattern to stop. Null steps
  // can only exist at the end of the array.
  //
  // While we're doing this, truncate the array to the correct size.
  const nullStep = Customs.getNullStep();
  const stepCount = Customs.getStepCount();
  var stepsCopy = steps.filter(function(s) {
    return !(s.red === nullStep.red &&
             s.green === nullStep.green &&
             s.blue === nullStep.blue);
  }).slice(0, stepCount);
  while (stepsCopy.length < stepCount) {
    stepsCopy.push(nullStep);
  }
  // Each step consists of an RGB value and is translated into 4 bytes.
  // The 4th byte is always zero.
  for (const step of stepsCopy) {
    buf.writeUInt8(TCPUtils.clampRGBW(step.red), index);
    index++;
    buf.writeUInt8(TCPUtils.clampRGBW(step.green), index);
    index++;
    buf.writeUInt8(TCPUtils.clampRGBW(step.blue), index);
    index++;
    buf.writeUInt8(0, index);
    index++;
  }
  // This function accepts a speed from 0 (slow) to 30 (fast).
  // The UFO seems to store/report the speed as 1 higher than what it really is.
  buf.writeUInt8(Customs.flipSpeed(speed) + 1, index);
  index++;
  // Set the mode.
  buf.writeUInt8(modeId, index);
  index++;
  // Add terminator and write.
  buf.writeUInt8(0xFF, index);
  this._write(TCPUtils.prepareBytes(buf), callback);
}

/*
Music, disco and camera modes:
  0x41 ?? ?? ?? ?? ?? 0x0F checksum
irrelevant mode because it's dependent on the device's audio, microphone or camera; individual transmissions just set the color
only relevant observation is that 41 is the header
*/
