// @flow
const { Map } = require('immutable');

/* Private variables */
const ack = '+ok';

/**
 * This {@link https://facebook.github.io/immutable-js/docs/#/Map Map} contains
 * common strings used in UFO UDP commands.
 */
const UdpStrings = {
  /** The standard acknowledgement message sent by both parties. */
  ack: ack,
  /** The prefix of all AT commands. */
  sendPrefix: 'AT+',
  /** The suffix of all AT commands. */
  sendSuffix: '\r',
  /** The prefix of all AT command responses that are not errors. */
  recvPrefix: ack,
  /** The suffix of all AT command responses that are not errors. */
  recvSuffix: '\r\n\r\n',
  /** The default UDP password. */
  defaultHello: 'HF-A11ASSISTHREAD',
  /** The prefix of all AT command responses that are errors. */
  errAck: '+ERR'
};

const exportMap: Map<string, string> = Map(UdpStrings);
module.exports = exportMap;
