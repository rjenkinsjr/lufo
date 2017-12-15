const UDPUtils = function() {};
// Standardizes a MAC address string.
UDPUtils.prototype.macAddress = function(mac) {
  return mac.toLowerCase().replace(/-/g, '').replace(/(.{2})/g,"$1:").slice(0, -1);
}
// Converts a UDP "hello" response to an object containing the IP, MAC and model of the UFO.
UDPUtils.prototype.getHelloResponse = function(response) {
  var splitResponse = response.toString('utf8').split(',');
  return {
    ip: splitResponse[0],
    mac: this.macAddress(splitResponse[1]),
    model: splitResponse[2]
  };
}
module.exports = Object.freeze(new UDPUtils());
