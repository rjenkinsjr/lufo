const util = require('util');

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
// Determines if the given object is a string.
Utils.prototype.isString = function(obj) {
  return typeof obj === 'string' || obj instanceof String;
}
// util.format(), but takes an array instead of varargs.
Utils.prototype.format = function(string, args) {
  var result = string;
  for (let arg of args) {
    result = util.format(result, arg);
  }
  return result;
}
// Compare two single-dimensional arrays.
Utils.prototype.arrayEquals = function(a, b) {
  if (!a || !b) return false;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (var i = 0, l = a.length; i < l; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}
module.exports = Object.freeze(new Utils());
