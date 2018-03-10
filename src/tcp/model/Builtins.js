// @flow
const _ = require('lodash');
const { Map, Set } = require('immutable');

/**
 * This class contains methods for utilizing a UFO's built-in functions. UFOs come with 20 such functions.
 */
class Builtins {
  /**
   * Returns the map of built-in function names to IDs. Function IDs are hexadecimal numbers.
   */
  getFunctions(): Map<string, number> {
    return Map({
      sevenColorCrossFade: 0x25,
      redGradualChange: 0x26,
      greenGradualChange: 0x27,
      blueGradualChange: 0x28,
      yellowGradualChange: 0x29,
      cyanGradualChange: 0x2A,
      purpleGradualChange: 0x2B,
      whiteGradualChange: 0x2C,
      redGreenCrossFade: 0x2D,
      redBlueCrossFade: 0x2E,
      greenBlueCrossFade: 0x2F,
      sevenColorStrobeFlash: 0x30,
      redStrobeFlash: 0x31,
      greenStrobeFlash: 0x32,
      blueStrobeFlash: 0x33,
      yellowStrobeFlash: 0x34,
      cyanStrobeFlash: 0x35,
      purpleStrobeFlash: 0x36,
      whiteStrobeFlash: 0x37,
      sevenColorJumpingChange: 0x38,
      noFunction: 0x61,
      postReset: 0x63
    });
  }
  /**
   * These functions should be used only internally; they are omitted from {@link Builtins#getFunctionNames}.
   */
  getSpecialFunctionNames(): Set<string> { return Set.of('noFunction', 'postReset'); }
  /**
   * Returns the set of valid UFO built-in function names. Does not include {@link Builtins#getSpecialFunctionNames}.
   */
  getFunctionNames(): Set<string> {
    return this.getFunctions().keySeq().toSet().subtract(this.getSpecialFunctionNames());
  }
  /**
   * Given a built-in function name, returns its hexadecimal ID.
   * @throws {Error} if an invalid function name is provided.
   */
  getFunctionId(name: string): number {
    if (!this.getFunctions().has(name)) throw new Error(`No such built-in function '${name}'.`);
    return this.getFunctions().get(name);
  };
  /**
   * Converts a built-in function speed value back and forth between the API value and the internal value.
   * Input and output are clamped to 0-100 inclusive.
   */
  flipSpeed(speed: number): number {
    return Math.abs(_.clamp(speed, 0, 100) - 100);
  }
}

module.exports = Object.freeze(new Builtins());
