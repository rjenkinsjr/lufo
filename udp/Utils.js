const Utils = function() {};
// Standardizes a MAC address string.
Utils.prototype.macAddress = function(mac) {
  return mac.toLowerCase().replace(/-/g, '').replace(/(.{2})/g,"$1:").slice(0, -1);
}
// Converts a UDP "hello" response to an object containing the IP, MAC and model of the UFO.
Utils.prototype.getHelloResponse = function(response) {
  var splitResponse = response.split(',');
  return {
    ip: splitResponse[0],
    mac: this.macAddress(splitResponse[1]),
    model: splitResponse[2]
  };
}
module.exports = Object.freeze(new Utils());
