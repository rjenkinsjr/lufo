// @flow

/* Private variables */
const on: Array<number> = [0x71, 0x23, 0x0F, 0xA3];
const off: Array<number> = [0x71, 0x24, 0x0F, 0xA4];

/** Static methods for controlling a UFO's power flag. */
export default class {
  /**
   * Returns the bytes for the "on" flag. The returned buffer already contains
   * the "local" byte and the checksum byte; do not pass this value to tcp/Utils.
   */
  static on(): Buffer { return Buffer.from(on); }
  /**
   * Returns the bytes for the "off" flag. The returned buffer already contains
   * the "local" byte and the checksum byte; do not pass this value to tcp/Utils.
   */
  static off(): Buffer { return Buffer.from(off); }
}
