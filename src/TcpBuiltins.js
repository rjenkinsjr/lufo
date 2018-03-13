// @flow
import { Map, Set } from 'immutable';
import _ from 'lodash';

/* Private variables */
const functionMap: Map<string, number> = Map({
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
  postReset: 0x63,
});
const specialFunctionNames: Set<string> = Set.of('noFunction', 'postReset');
const functionNames: Set<string> = functionMap.keySeq().toSet().subtract(specialFunctionNames);
const maxSpeed = 100;

/**
 * Static methods for utilizing a UFO's built-in functions. UFOs come with 20
 * such functions.
 */
export default class {
  /**
   * Returns the map of built-in function names to IDs. Function IDs are
   * hexadecimal numbers. This map includes internal function names that are
   * excluded by {@link TcpBuiltins.getFunctionNames}.
   */
  static getFunctions(): Map<string, number> { return functionMap; }
  /** Returns the set of valid built-in function names usable by the CLI/API. */
  static getFunctionNames(): Set<string> { return functionNames; }
  /**
   * Given a built-in function name, returns its hexadecimal ID.
   * @throws {Error} if an invalid function name is provided.
   */
  static getFunctionId(name: string): number {
    const id: number | void = functionMap.get(name);
    if (!id) throw new Error(`No such built-in function '${name}'.`);
    return id;
  }
  /**
   * Converts a built-in function speed value back and forth between the API
   * value and the internal value. Input and output are clamped to 0-100
   * inclusive.
   */
  static flipSpeed(speed: number): number { return Math.abs(_.clamp(speed, 0, maxSpeed) - maxSpeed); }
}
