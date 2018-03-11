// @flow
const _ = require('lodash');
const { Map, Set } = require('immutable');
const fs = require('fs');
const builtinMap = Map(JSON.parse(fs.readFileSync(__dirname + '/builtins.json', 'utf8'))).map(v => parseInt(v, 16));

/**
 * This class contains methods for utilizing a UFO's built-in functions. UFOs come with 20 such functions.
 */
class Builtins {
  /**
   * Returns the map of built-in function names to IDs. Function IDs are hexadecimal numbers.
   */
  getFunctions(): Map<string, number> {
    return builtinMap;
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
