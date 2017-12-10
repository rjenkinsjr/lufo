const UFOH = require('./UFOHelper.js');

/*
 * Constructor
 */
var UFO = module.exports = function(options, callback) {
  this._options = options;

  // UFOs will close connections after a cetain time of not receiving any data.
  // TCP keepalives from Node don't seem to help.
  // This flag is used by the "close" event handler to re-establish a connection
  // that was unknowingly closed by the UFO.
  //
  // If this is true, this UFO instance is unusable and will no longer perform
  // any UFO control methods (e.g. rgbw).
  this._dead = false;

  // Storage/tracking for the status response.
  this._statusArray = new Uint8Array(UFOH.statusResponseSize);
  this._statusIndex = 0;

  // Setup the TCP socket.
  UFOH.initializeClient(this);

  // Connect now, if a callback was requested.
  typeof callback === 'function' && this.connect(callback);
};

/*
 * Core methods
 */
UFO.prototype.connect = function(callback) {
  if (UFOH.stopIfDead(this, callback)) return;
  this._client.connect({
    host: this._options.host,
    port: UFOH.tcpPort
  }, function() {
    typeof callback === 'function' && callback();
  });
}
UFO.prototype.disconnect = function() {
  // If already dead, stop now.
  if (this._dead) return;
  // We're intentionally closing this connection.
  // Don't allow it to be used again.
  this._dead = true;
  this._client.end();
}
UFO.prototype.status = function(callback) {
  if (UFOH.stopIfDead(this, callback)) return;
  this._client.resume();
  this._statusCallback = function(err, data) {
    typeof callback === 'function' && callback(err, data);
    this._statusCallback = null;
    this._client.pause();
  }.bind(this);
  this._client.write(UFOH.statusRequest);
}
UFO.prototype.on = function(callback) {
  if (UFOH.stopIfDead(this, callback)) return;
  this._client.write(UFOH.onRequest, callback);
}
UFO.prototype.off = function(callback) {
  if (UFOH.stopIfDead(this, callback)) return;
  this._client.write(UFOH.offRequest, callback);
}

/*
 * Standard control methods
 */
UFO.prototype.rgbw = function(red, green, blue, white, callback) {
  if (UFOH.stopIfDead(this, callback)) return;
  // 0x31 rr gg bb ww 0x00
  // 0x00 seems to be a constant terminator for the data.
  var buf = Buffer.alloc(6);
  buf.writeUInt8(0x31, 0);
  buf.writeUInt8(UFOH.clampRGBW(red), 1);
  buf.writeUInt8(UFOH.clampRGBW(green), 2);
  buf.writeUInt8(UFOH.clampRGBW(blue), 3);
  buf.writeUInt8(UFOH.clampRGBW(white), 4);
  buf.writeUInt8(0, 5);
  this._client.write(UFOH.prepareBytes(buf), callback);
}
UFO.prototype.builtin = function(name, speed, callback) {
  if (UFOH.stopIfDead(this, callback)) return;
  // 0x61 id speed
  var buf = Buffer.alloc(3);
  buf.writeUInt8(0x61, 0);
  buf.writeUInt8(UFOH.functionIds[name], 1);
  // This function accepts a speed from 0 (slow) to 100 (fast).
  buf.writeUInt8(UFOH.flipSpeedBuiltin(speed), 2);
  this._client.write(UFOH.prepareBytes(buf), callback);
}
UFO.prototype.custom = function(speed, mode, steps, callback) {
  if (UFOH.stopIfDead(this, callback)) return;
  // Validate the mode.
  var modeId;
  switch (mode) {
    case 'gradual':
      modeId = 0x3a;
      break;
    case 'jumping':
      modeId = 0x3b;
      break;
    case 'strobe':
      modeId = 0x3c;
      break;
    default:
      typeof callback === 'function' && callback(new Error(`Invalid mode '${mode}'.`));
      break;
  }
  // 0x51 steps(16xUInt8) speed mode 0xff
  // 0xff seems to be a constant terminator for the data.
  var buf = Buffer.alloc(68);
  buf.writeUInt8(0x51, 0);
  var index = 1;
  // Each step consists of an RGB value and is translated into 4 bytes.
  // The 4th byte is always zero.
  //
  // If there are fewer than 16 steps, "null" steps must be added so we have
  // exactly 16 steps. A "null" step is 0x01 0x02 0x03 0x00.
  //
  // Any null steps intermingled with non-null steps must be removed, as they
  // will cause the pattern to stop. Null steps can only exist at the end of
  // the array.
  //
  // While we're doing this, truncate the array to size 16.
  var stepsCopy = steps.filter(function(s) {
    return !(s.red === UFOH.nullStep.red &&
             s.green === UFOH.nullStep.green &&
             s.blue === UFOH.nullStep.blue);
  }).slice(0, UFOH.customStepsSize);
  while (stepsCopy.length < UFOH.customStepsSize) {
    stepsCopy.push(UFOH.nullStep);
  }
  for (const step of stepsCopy) {
    buf.writeUInt8(UFOH.clampRGBW(step.red), index);
    index++;
    buf.writeUInt8(UFOH.clampRGBW(step.green), index);
    index++;
    buf.writeUInt8(UFOH.clampRGBW(step.blue), index);
    index++;
    buf.writeUInt8(0, index);
    index++;
  }
  // This function accepts a speed from 0 (slow) to 30 (fast).
  buf.writeUInt8(UFOH.flipSpeedCustom(speed) + 1, index);
  index++;
  // Set the mode.
  buf.writeUInt8(modeId, index);
  index++;
  // Add terminator and write.
  buf.writeUInt8(0xff, index);
  this._client.write(UFOH.prepareBytes(buf), callback);
}

/*
 * Helper methods
 */
 UFO.prototype.getHost = function() {
   return this._options.host;
 }
UFO.prototype.freeze = function(callback) {
  if (UFOH.stopIfDead(this, callback)) return;
  this.builtin('noFunction', 0, callback);
}
UFO.prototype.zero = function(callback) {
  if (UFOH.stopIfDead(this, callback)) return;
  this.rgbw(0, 0, 0, 0, callback);
}

/*
Disco and camera modes:
  0x41 ?? ?? ?? ?? ?? 0x0f checksum
irrelevant mode because it's dependent on the device's microphone or camera; individual transmissions just set the color
only relevant observation is that 41 is the header
*/
