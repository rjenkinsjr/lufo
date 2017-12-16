const MiscUtils = lufoRequire('misc/Utils');

const Utils = function() {};
// Clamps RGBW values within the accepted range (0 <= value <= 255).
Utils.prototype.clampRGBW = function(num) {
  return MiscUtils.clamp(num, 0, 255);
}
// Given a buffer of data destined for a UFO, expands the buffer by 2 and
// inserts the last two bytes (the "local" constant 0x0f, and the checksum).
//
// Returns a new buffer and leaves the input buffer unmodified.
Utils.prototype.prepareBytes = function(buf) {
  var newBuf = Buffer.alloc(buf.length + 2);
  buf.copy(newBuf);
  this.finalizeBytes(newBuf);
  this.checksumBytes(newBuf);
  return newBuf;
}
// Adds the "local" flag to the given buffer.
//
// For virtually all datagrams sent to UFOs, the second-to-last byte is either
// 0f (local) or (f0) remote. "Remote" refers to UFOs that are exposed to the
// Internet via the company's cloud service, which is not supported by this
// library, so we always use "local".
//
// Expects a buffer from the prepareBytes method.
Utils.prototype.finalizeBytes = function(buf) {
  buf.writeUInt8(0x0f, buf.length - 2);
}
// Adds the checksum to the buffer.
//
// Expects a buffer from the prepareBytes method.
Utils.prototype.checksumBytes = function(buf) {
  // Sanity.
  var lastIndex = buf.length - 1;
  buf.writeUInt8(0, lastIndex);
  // Sum up all the values in the buffer, then divide by 256.
  // The checksum is the remainder.
  var checksum = 0;
  for (const value of buf.values()) {
    checksum += value;
  }
  checksum = checksum % 0x100;
  buf.writeUInt8(checksum, lastIndex);
}
module.exports = Object.freeze(new Utils());
