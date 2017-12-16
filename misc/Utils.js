var Utils = function () {};
// Returns the input string if it is found in the array, or else returns the default value.
Utils.prototype.checkWithDefault = function(input, options, defaultValue) {
  return options.indexOf(input) > -1 ? input : defaultValue;
}
// Clamps a number between two values, both inclusive.
Utils.prototype.clamp = function(num, min, max) {
  if (min > max) throw new Error(`Min ${min} greater than max ${max}`);
  return num <= min ? min : num >= max ? max : num;
}
module.exports = Object.freeze(new Utils());
