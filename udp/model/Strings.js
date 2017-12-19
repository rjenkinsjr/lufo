// The standard acknowledgement message sent by both parties.
const ack = '+ok';
module.exports = Object.freeze({
  ack: ack,
  // This is the prefix of all AT commands.
  sendPrefix: 'AT+',
  // This is the suffix of all AT commands.
  sendSuffix: '\r',
  // This is the prefix of all AT command responses that are not errors.
  recvPrefix: ack,
  // This is the suffic of all AT command responses that are not errors.
  recvSuffix: '\r\n\r\n',
  // This is the default UDP password.
  defaultHello: 'HF-A11ASSISTHREAD',
  // This is the prefix of all AT command responses that are errors.
  errAck: '+ERR'
});
