// @flow
const fs = require('fs');
const { Map, Set } = require('immutable');
const _ = require('lodash');

/* Private variables */
const functionMap = Map(JSON.parse(fs.readFileSync(__dirname + '/functionMap.json', 'utf8'))).map(v => parseInt(v, 16));
const specialFunctionNames = Set.of('noFunction', 'postReset');
const functionNames = functionMap.keySeq().toSet().subtract(specialFunctionNames);
const maxSpeed = 100;

/**
 * This class contains methods for utilizing a UFO's built-in functions. UFOs come with 20 such functions.
 */
class TcpBuiltins {
  /**
   * Returns the map of built-in function names to IDs. Function IDs are hexadecimal numbers.
   * This map includes internal function names that are excluded by {@link TcpBuiltins#getFunctionNames}.
   */
  getFunctions(): Map<string, number> { return functionMap; }
  /**
   * Returns the set of valid UFO built-in function names usable by the CLI/API.
   */
  getFunctionNames(): Set<string> { return functionNames; }
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
    return Math.abs(_.clamp(speed, 0, maxSpeed) - maxSpeed);
  }
}

module.exports = Object.freeze(new TcpBuiltins());
