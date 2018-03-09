// @flow
const _ = require('lodash');

const Customs = function () {
  // A single custom function command always contains exactly this many steps.
  this.stepCount = 16;
  // The definition of a null step, used to fill in missing steps as the end of
  // the byte stream to produce a valid payload.
  this.nullStep = Object.freeze({ red: 1, green: 2, blue: 3 });
};
// Converts a custom command speed value back/forth between what the
// user inputs and what is transmitted in the byte array.
Customs.prototype.flipSpeed = function(speed: number) {
  return Math.abs(_.clamp(speed, 0, 30) - 30);
}
module.exports = Object.freeze(new Customs());
