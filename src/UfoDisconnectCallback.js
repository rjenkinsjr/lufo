// @flow
/**
 * A callback function that is invoked once a {@link Ufo} object has
 * disconnected from the UFO, either because the {@link Ufo.disconnect} method
 * was called or because a communication error occurred. The callback accepts a
 * single error argument that, if not null, contains the error that caused the
 * disconnect.
 * @callback
 */
export type UfoDisconnectCallback = (?Error) => mixed;
