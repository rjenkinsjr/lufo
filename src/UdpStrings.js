// @flow

/* Private variables */
const ack: string = '+ok';

/**
 * This class contains common strings used in UFO UDP commands.
 */
export default class {
  /** The standard acknowledgement message sent by both parties. */
  static ack(): string { return ack; }
  /** The prefix of all AT commands. */
  static sendPrefix(): string { return 'AT+'; }
  /** The suffix of all AT commands. */
  static sendSuffix(): string { return '\r'; }
  /** The prefix of all AT command responses that are not errors. */
  static recvPrefix(): string { return ack; }
  /** The suffix of all AT command responses that are not errors. */
  static recvSuffix(): string { return '\r\n\r\n'; }
  /** The default UDP password. */
  static defaultHello(): string { return 'HF-A11ASSISTHREAD'; }
  /** The prefix of all AT command responses that are errors. */
  static errAck(): string { return '+ERR'; }
}
