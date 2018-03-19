// @flow
/**
 * The CLI for controlling UFOs.
 * @namespace lufo
 */
/**
 * Searches for UFOs on the network and returns the list of UFOs that were
 * found.
 * @memberof lufo
 * @function discover
 * @alias d
 * @param {number} [timeout] How long the CLI waits for UFO responses; defaults
 * to 3 seconds.
 * @returns {[{ip: string, mac: string, model: string}]} a JSON array of objects
 * describing the discovered UFOs.
 * @example
 * // Search the network for UFOs for 3 seconds.
 * $ lufo discover
 * // Search the network for UFOs for 10 seconds.
 * $ lufo discover 10
 * // Sample output:
 * [
 *   {
 *     "ip": "192.168.0.0",
 *     "mac": "00:00:00:12:34:af",
 *     "model": "HF-LPB100-ZJ200"
 *   }
 * ]
 */
