// @flow

/**
 * Errors of this type are thrown when communication with a UFO fails. The error
 * object contains a message and an optional error from the UDP and TCP sockets
 * that may have contributed to this error.
 */
class UfoDisconnectError extends Error {
  udpError: Error;
  tcpError: Error;
  constructor(message: string, udpError: Error, tcpError: Error) {
    super(message);
    Error.captureStackTrace(this, UfoDisconnectError);
    this.udpError = udpError;
    this.tcpError = tcpError;
  }
}

export default UfoDisconnectError;
