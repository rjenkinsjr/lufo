// @flow

/* Private variables */
const on = [0x71, 0x23, 0x0F, 0xA3];
const off = [0x71, 0x24, 0x0F, 0xA4];

/**
 * This class contains methods for controlling a UFO's power flag.
 */
class TcpPower {
  /**
   * Returns the bytes for the "on" flag. The returned buffer already contains
   * the "local" byte and the checksum byte; do not pass this value to tcp/Utils.
   */
  on(): Buffer { return Buffer.from(on); }
  /**
   * Returns the bytes for the "off" flag. The returned buffer already contains
   * the "local" byte and the checksum byte; do not pass this value to tcp/Utils.
   */
  off(): Buffer { return Buffer.from(off); }
}

module.exports = Object.freeze(new TcpPower());
