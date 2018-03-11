// @flow

/* Private variables */
const ack = '+ok';

/**
 * This class contains common strings used in UFO UDP commands.
 */
class UdpStrings {
  /** The standard acknowledgement message sent by both parties. */
  ack(): string { return ack; }
  /** The prefix of all AT commands. */
  sendPrefix(): string { return 'AT+'; }
  /** The suffix of all AT commands. */
  sendSuffix(): string { return '\r'; }
  /** The prefix of all AT command responses that are not errors. */
  recvPrefix(): string { return ack; }
  /** The suffix of all AT command responses that are not errors. */
  recvSuffix(): string { return '\r\n\r\n'; }
  /** The default UDP password. */
  defaultHello(): string { return 'HF-A11ASSISTHREAD'; }
  /** The prefix of all AT command responses that are errors. */
  errAck(): string { return '+ERR'; }
};

module.exports = Object.freeze(new UdpStrings());
