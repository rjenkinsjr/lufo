var Utils = function () {};
// Clamps a number between two values, both inclusive.
Utils.prototype.clamp = function(num, min, max) {
  if (min > max) throw new Error(`Min ${min} greater than max ${max}`);
  return num <= min ? min : num >= max ? max : num;
}
// Clamps RGBW values within the accepted range (0 <= value <= 255).
Utils.prototype.clampRGBW = function(num) {
  return this.clamp(num, 0, 255);
}
// Standardizes a MAC address string
Utils.prototype.macAddress = function(mac) {
  return mac.toLowerCase().replace(/-/g, '').replace(/(.{2})/g,"$1:").slice(0, -1);
}
module.exports = Object.freeze(new Utils());
