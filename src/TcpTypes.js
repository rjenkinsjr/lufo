// @flow
/**
 * Data types used by various UFO TCP functions.
 * @namespace TcpTypes
 */

/**
 * A "null step" in a list of custom steps.
 * @memberof TcpTypes
 */
export type NullStep = { red: 1, green: 2, blue: 3 };

/**
 * A function that parses the response from the "status" command.
 * @memberof TcpTypes
 */
export type StatusResponseHandler = (data: Buffer) => void;
