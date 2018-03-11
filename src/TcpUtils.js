// @flow
const _ = require('lodash');

/**
 * This class contains utility methods for handling UFO TCP data.
 */
class TcpUtils {
  /**
   * Clamps the input to 0-255 inclusive, for use as an RGBW value.
   */
  clampRGBW(value: number): number { return _.clamp(value, 0, 255); }
  /**
   * Given a buffer of data destined for a UFO, expands the buffer by 2 and
   * inserts the last two bytes (the "local" flag 0x0f and the checksum).
   *
   * A new buffer is returned; the input buffer is not modified.
   */
  prepareBytes(buf: Buffer): Buffer {
    const newBuf = Buffer.alloc(buf.length + 2);
    buf.copy(newBuf);
    // Add the "local" flag to the given buffer.
    //
    // For virtually all datagrams sent to UFOs, the second-to-last byte is either
    // 0f (local) or (f0) remote. "Remote" refers to UFOs that are exposed to the
    // Internet via the company's cloud service, which is not supported by this
    // library, so we always use "local".
    newBuf.writeUInt8(0x0f, newBuf.length - 2);
    // Zero out the checksum field for safety.
    const lastIndex = newBuf.length - 1;
    newBuf.writeUInt8(0, lastIndex);
    // Sum up all the values in the buffer, then divide by 256.
    // The checksum is the remainder.
    let checksum = 0;
    for (const value of newBuf.values()) {
      checksum += value;
    }
    checksum %= 0x100;
    newBuf.writeUInt8(checksum, lastIndex);
    // Done.
    return newBuf;
  }
}

module.exports = Object.freeze(new TcpUtils());
