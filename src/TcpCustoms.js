// @flow
import _ from 'lodash';

/** A "null step" in a list of custom steps. */
type NullStep = { red: 1, green: 2, blue: 3 };

/* Private variables */
const nullStep: NullStep = { red: 1, green: 2, blue: 3 };
Object.freeze(nullStep);
const maxSpeed = 30;

/** Static methods for working with UFO custom functions. */
export default class {
  /** Returns 16, the maximum number of steps allowed in a single custom function command. */
  static getStepCount(): number { return 16; }
  /**
   * Returns the object definition of a null step; these are used to fill in
   * missing steps at the end of the byte stream to produce a valid payload.
   */
  static getNullStep(): NullStep { return nullStep; }
  /**
   * Converts a custom function speed value back and forth between the API value and the internal value.
   * Input and output are clamped to 0-30 inclusive.
   */
  static flipSpeed(speed: number): number { return Math.abs(_.clamp(speed, 0, maxSpeed) - maxSpeed); }
}
