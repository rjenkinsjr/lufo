const Power = function() {};
// 0x71 0x23 0x0F 0xA3, always.
// This includes local flag and checksum; do not pass to TCPUtils.
Power.prototype.on = function() { return Buffer.from([0x71, 0x23, 0x0F, 0xA3]); };
// 0x71 0x24 0x0F 0xA4, always.
// This includes local flag and checksum; do not pass to TCPUtils.
Power.prototype.off = function() { return Buffer.from([0x71, 0x24, 0x0F, 0xA4]); };
module.exports = Object.freeze(new Power());
