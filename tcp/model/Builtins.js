const _ = require('lodash');

/*
 * Exports
 */

const Builtins = function () {
  // Function name/id map.
  this.functionIds = Object.freeze({
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
};
// Given a function name, returns its hex value.
Builtins.prototype.getFunctionId = function(name) {
  if (!this.functionIds.hasOwnProperty(name)) throw new Error(`No such built-in function '${name}'.`);
  return this.functionIds[name];
};
// Converts a built-in function speed value back/forth between what the
// user inputs and what is transmitted in the byte array.
Builtins.prototype.flipSpeed = function(speed) {
  return Math.abs(_.clamp(speed, 0, 100) - 100);
}

module.exports = Object.freeze(new Builtins());
