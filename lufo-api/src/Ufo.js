// @flow
import EventEmitter from 'events';
import { TcpClient } from './TcpClient';
import type { BuiltinFunction, CustomMode, CustomStep, UfoStatus } from './TcpClient';
import { UdpClient } from './UdpClient';
import type { DiscoveredUfo, UfoDiscoverOptions, WifiNetwork } from './UdpClient';
import { UfoDisconnectError } from './Misc';
import type { UfoDisconnectCallback, UfoOptions } from './Misc';

/**
 * The API for interfacing with UFO devices. If a callback is provided during
 * construction, {@link Ufo#connect} is called immediately after construction.
 */
class Ufo extends EventEmitter {
  _dead: boolean;
  _options: UfoOptions;
  _disconnectCallback: ?UfoDisconnectCallback;
  _tcpClient: TcpClient;
  _udpClient: UdpClient;
  _tcpError: ?Error;
  _udpError: ?Error;
  constructor(options: UfoOptions) {
    super();
    // Flag that tracks the state of this UFO object.
    this._dead = false;
    // Capture the options provided by the user.
    this._options = Object.freeze(options);
    this._disconnectCallback = this._options.disconnectCallback;
    // Create the TCP and UDP clients.
    this._tcpClient = new TcpClient(this, options);
    this._udpClient = new UdpClient(this, options);
    // Define the "client is dead" event handlers.
    this._tcpError = null;
    this.on('tcpDead', (err) => {
      this._dead = true;
      this._tcpError = err;
      if (this._udpClient._dead) {
        this.emit('dead');
      } else {
        this._udpClient.disconnect();
      }
    });
    this._udpError = null;
    this.on('udpDead', (err) => {
      this._dead = true;
      this._udpError = err;
      if (this._tcpClient._dead) {
        this.emit('dead');
      } else {
        this._tcpClient.disconnect();
      }
    });
    // Define the "UFO is dead" event handler, invoked once both clients are closed.
    this.on('dead', () => {
      // Invoke the disconnect callback, if one is defined.
      let error = null;
      if (this._udpError || this._tcpError) {
        error = new UfoDisconnectError('UFO disconnected due to an error.', this._udpError, this._tcpError);
      }
      const dc = this._disconnectCallback;
      if (dc) dc(error);
    });
    // Make sure this UFO disconnects before NodeJS exits.
    process.on('exit', (code) => { this.disconnect(); }); // eslint-disable-line no-unused-vars
  }
  /** Searches for UFOs on the network. Returned array may be empty. */
  static discover(options: UfoDiscoverOptions): Promise<Array<DiscoveredUfo>> {
    return UdpClient.discover(options);
  }
  /** Returns the list of built-in functions usable by the API/CLI. */
  static getBuiltinFunctions(): Array<BuiltinFunction> {
    return TcpClient.getBuiltinFunctions();
  }
  /** Indicates whether or not the given custom step is a null step. */
  static isNullStep(step: CustomStep): boolean {
    return TcpClient.isNullStep(step);
  }
  /*
   * Connect/disconnect methods
   */
  /**
   * Establishes a connection to the UFO. If this method fails, it is safe to
   * retry connecting unless the error implies that retrying is not ppropriate.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
      this._udpClient.connect().then(() => {
        this._tcpClient.connect().then(resolve).catch(reject);
      }).catch(reject);
    });
  }
  /**
   * Disconnects from the UFO. After disconnecting, this object cannot be used;
   * you must construct a new {@link Ufo} object to reconnect.
   */
  disconnect() {
    if (this._dead) return;
    this._dead = true;
    this._tcpClient.disconnect();
    this._udpClient.disconnect();
  }
  /*
   * Query methods
   */
  /**
   * Gets the UFO's output status and sends it to the given callback.
   * The callback is guaranteed to have exactly one non-null argument.
   */
  getStatus(callback: (error: ?Error, data: ?UfoStatus) => void): void {
    this._tcpClient.status(callback);
  }
  /*
   * RGBW control methods
   */
  /**
   * Sets the UFO's output flag to the given value, then invokes the given
   * callback.
   */
  setPower(on: boolean, callback: ?() => void): void {
    if (on) this.turnOn(callback);
    else this.turnOff(callback);
  }
  /** Turns the UFO on, then invokes the given callback. */
  turnOn(callback: ?() => void): void {
    this._tcpClient.on(callback);
  }
  /** Turns the UFO off, then invokes the given callback. */
  turnOff(callback: ?() => void): void {
    this._tcpClient.off(callback);
  }
  /** Toggle the UFO's output flag, then invokes the given callback. */
  togglePower(callback: ?(?Error) => void): void {
    this.getStatus((err, status) => {
      if (err) {
        if (callback) callback(err);
      } else if (status && status.on) {
        this.turnOff(callback);
      } else {
        this.turnOn(callback);
      }
    });
  }
  /**
   * Sets the UFO output to the static values specified, then invokes the given
   * calllback. The RGBW values are clamped from 0-255 inclusive, where 0 is off
   * and 255 is fully on/100% output.
   */
  setColor(red: number, green: number, blue: number, white: number, callback: ?() => void): void {
    this._tcpClient.rgbw(red, green, blue, white, callback);
  }
  /**
   * Sets the red output value, then invokes the given callback. If solo is
   * true, all other output values are set to zero. Input value is clamped to
   * 0-255 inclusive.
   */
  setRed(value: number, solo: boolean, callback: (?Error) => void) {
    this._setSingle(0, value, solo, callback);
  }
  /**
   * Sets the green output value, then invokes the given callback. If solo is
   * true, all other output values are set to zero. Input value is clamped to
   * 0-255 inclusive.
   */
  setGreen(value: number, solo: boolean, callback: (?Error) => void) {
    this._setSingle(1, value, solo, callback);
  }
  /**
   * Sets the blue output value, then invokes the given callback. If solo is
   * true, all other output values are set to zero. Input value is clamped to
   * 0-255 inclusive.
   */
  setBlue(value: number, solo: boolean, callback: (?Error) => void) {
    this._setSingle(2, value, solo, callback);
  }
  /**
   * Sets the white output value, then invokes the given callback. If solo is
   * true, all other output values are set to zero. Input value is clamped to
   * 0-255 inclusive.
   */
  setWhite(value: number, solo: boolean, callback: (?Error) => void) {
    this._setSingle(3, value, solo, callback);
  }
  /**
   * Sets the given position in the RGBW byte array, then invokes the given
   * callback. If solo is true, all other output values are set to zero. Input
   * value is clamped to 0-255 inclusive.
   * @private
   */
  _setSingle(position: number, value: number, solo: boolean, callback: (?Error) => void) {
    if (solo) {
      const values = [0, 0, 0, 0];
      values[position] = value;
      this.setColor(...values, callback);
    } else {
      this.getStatus((err, data) => {
        if (err) {
          callback(err);
        } else if (data) {
          const values = [data.red, data.green, data.blue, data.white];
          values[position] = value;
          this.setColor(...values, callback);
        }
      });
    }
  }
  /**
   * Starts one of the UFO's built-in functions at the given speed, then invokes
   * the given callback. The error is always null unless an invalid function
   * name is given.
   *
   * The speed is clamped from 0-100 inclusive. Speed values do not result in
   * the same durations across all functions (e.g. sevenColorStrobeFlash is
   * much faster at speed 100 than sevenColorJumpingChange); you will need to
   * experiment with different values to get the desired timing for the function
   * you wish to use.
   */
  setBuiltin(name: BuiltinFunction, speed: number, callback: ?(error: ?Error) => void): void {
    this._tcpClient.builtin(name, speed, callback);
  }
  /**
   * Starts the given custom function, then invokes the given callback. The
   * error is always null unless an invalid mode is given.
   * - The speed is clamped from 0-30 inclusive. Below is a list of step
   * durations measured with a stopwatch when using the "jumping" mode. These
   * values should be treated as approximations. Based on this list, it appears
   * decrementing the speed by 1 increases step duration by 0.14 seconds.
   *    - 30 = 0.4 seconds
   *    - 25 = 1.1 seconds
   *    - 20 = 1.8 seconds
   *    - 15 = 2.5 seconds
   *    - 10 = 3.2 seconds
   *    - 5 = 3.9 seconds
   *    - 0 = 4.6 seconds
   * - Only the first 16 steps in the given array are considered. Any additional
   * steps are ignored.
   * - If any null steps are specified in the array, they are dropped *before*
   * the limit of 16 documented above is considered.
   */
  setCustom(mode: CustomMode, speed: number, steps: Array<CustomStep>, callback: ?(error: ?Error) => void): void {
    this._tcpClient.custom(mode, speed, steps, callback);
  }
  /**
   * Freezes the playback of whatever built-in or custom function is currently
   * running. The output remains on after being frozen.
   */
  freezeOutput(callback: ?(error: ?Error) => void): void {
    this.setBuiltin('noFunction', 0, callback);
  }
  /** Sets all output to zero. */
  zeroOutput(callback: ?(error: ?Error) => void): void {
    this.setColor(0, 0, 0, 0, callback);
  }
  /*
   * UFO configuration getter methods
   */
  /** Returns the UFO's hardware/firmware version. */
  getVersion(callback: (?Error, string) => void): void {
    this._udpClient.getVersion(callback);
  }
  /** Returns the UFO's NTP server IP address. */
  getNtpServer(callback: (?Error, string) => void): void {
    this._udpClient.getNtpServer(callback);
  }
  /**
   * Returns the UFO's WiFi "auto-switch" setting, which is one of the
   * following:
   * - "off", which means auto-switch is disabled.
   * - "on", which means 1 minutes.
   * - "auto", which means 10 minutes.
   * - The number of minutes, 3-120 inclusive.
   *
   * If auto-switch is anything but "off", and if the UFO fails to connect to
   * its client AP or otherwise enters any abnormal state, the UFO will reset
   * itself and enable its AP mode after the specified number of minutes have
   * passed.
   *
   * Note that this method always returns a string even if the value is a
   * number.
   */
  getWifiAutoSwitch(callback: (?Error, string) => void): void {
    this._udpClient.getWifiAutoSwitch(callback);
  }
  /**
   * Returns the UFO's WiFi mode:
   * - "AP" (AP mode)
   * - "STA" (client mode)
   * - "APSTA" (client and AP mode)
   */
  getWifiMode(callback: (?Error, string) => void): void {
    this._udpClient.getWifiMode(callback);
  }
  /** Performs a WiFi AP scan from the UFO and returns the results. */
  doWifiScan(callback: (?Error, Array<WifiNetwork>) => void): void {
    this._udpClient.doWifiScan(callback);
  }
  /** Returns the IP address and netmask of the UFO AP. */
  getWifiApIp(callback: (?Error, ?{ip: string, mask: string}) => void): void {
    this._udpClient.getWifiApIp(callback);
  }
  /** Returns the UFO AP's broadcast information. Channel is 1-11 inclusive. */
  getWifiApBroadcast(callback: (?Error, ?{mode: 'b' | 'bg' | 'bgn', ssid: string, channel: number}) => void): void {
    this._udpClient.getWifiApBroadcast(callback);
  }
  /** Returns the UFO AP's passphrase. If null, AP network is open. */
  getWifiApPassphrase(callback: (?Error, ?string) => void): void {
    this._udpClient.getWifiApPassphrase(callback);
  }
  /**
   * Returns the UFO AP's connection LED flag. If on, the UFO's blue LED will
   * turn on when any client is connected to the AP.
   */
  getWifiApLed(callback: (?Error, boolean) => void): void {
    this._udpClient.getWifiApLed(callback);
  }
  /**
   * Returns the UFO AP's DHCP server settings. If DHCP is on, the returned
   * object's "start" and "end" properties will be 0-254 inclusive.
   */
  getWifiApDhcp(callback: (?Error, ?{on: boolean, start?: number, end?: number}) => void): void {
    this._udpClient.getWifiApDhcp(callback);
  }
  /**
   * Returns the UFO client's AP SSID and MAC address. If the UFO is not
   * connected to any AP, the returned object will be null.
   */
  getWifiClientApInfo(callback: (?Error, ?{ssid: string, mac: string}) => void): void {
    this._udpClient.getWifiClientApInfo(callback);
  }
  /** Returns the UFO client's AP signal strength, as seen by the UFO. */
  getWifiClientApSignal(callback: (?Error, string) => void): void {
    this._udpClient.getWifiClientApSignal(callback);
  }
  /** Returns the UFO client's IP configuration. */
  getWifiClientIp(callback: (?Error, ?{dhcp: boolean, ip: string, mask: string, gateway: string}) => void): void {
    this._udpClient.getWifiClientIp(callback);
  }
  /** Returns the UFO client's AP SSID. */
  getWifiClientSsid(callback: (?Error, string) => void): void {
    this._udpClient.getWifiClientSsid(callback);
  }
  /**
   * Returns the UFO client's AP auth settings.
   * - If auth is OPEN, encryption is NONE, WEP-H or WEP-A.
   * - If auth is SHARED, encryption is WEP-H or WEP-A.
   * - If auth is WPAPSK or WPA2PSK, encryption is TKIP or AES.
   * - If encryption is NONE, paraphrase is null.
   * - If encryption is WEP-H, paraphrase is exactly 10 or 26 hexadecimal
   * characters in length.
   * - If encryption is WEP-A, paraphrase is exactly 5 or 13 ASCII characters in
   * length.
   * - If encryption is TKIP or AES, paraphrase is 8-63 ASCII characters in
   * length, inclusive.
   */
  getWifiClientAuth(callback: (?Error, ?{auth: string, encryption: string, passphrase: string | null}) => void): void {
    this._udpClient.getWifiClientAuth(callback);
  }
  /*
   * UFO configuration setter methods
   */
  /** Sets the NTP server IP address. */
  setNtpServer(ipAddress: string, callback: ?(?Error) => void): void {
    this._udpClient.setNtpServer(ipAddress, callback);
  }
  /**
   * Sets the UFO's UDP password. If an error occurs while executing this
   * command, the owning UFO object will be disconnected and the given callback
   * (if any) will override whatever disconnect callback was previously defined.
   */
  setUdpPassword(password: string, callback: ?(?Error) => void): void {
    this._udpClient.setUdpPassword(password, callback);
  }
  /**
   * Sets the UFO's TCP port. The owning UFO object will be disconnected after
   * this method is invoked. If a callback is provided to this method, it
   * overrides whatever disconnect callback was defined when the client was
   * constructed.
   */
  setTcpPort(port: number, callback?: UfoDisconnectCallback): void {
    this._udpClient.setTcpPort(port, callback);
  }
  /**
   * Sets the UFO's WiFi "auto-switch" setting, which is one of the following:
   * - "off", which means auto-switch is disabled.
   * - "on", which means 1 minutes.
   * - "auto", which means 10 minutes.
   * - The number of minutes, 3-120 inclusive.
   *
   * If auto-switch is anything but "off", and if the UFO fails to connect to
   * its client AP or otherwise enters any abnormal state, the UFO will reset
   * itself and enable its AP mode after the specified number of minutes have
   * passed.
   */
  setWifiAutoSwitch(value: 'off' | 'on' | 'auto' | number, callback: ?(?Error) => void): void {
    this._udpClient.setWifiAutoSwitch(value, callback);
  }
  /**
   * Sets the UFO's WiFi mode:
   * - "AP" (AP mode)
   * - "STA" (client mode)
   * - "APSTA" (client and AP mode)
   */
  setWifiMode(mode: 'AP' | 'STA' | 'APSTA', callback: ?(?Error) => void): void {
    this._udpClient.setWifiMode(mode, callback);
  }
  /** Sets the IP address and netmask of the UFO AP. */
  setWifiApIp(ip: string, mask: string, callback: ?(?Error) => void): void {
    this._udpClient.setWifiApIp(ip, mask, callback);
  }
  /** Sets the UFO AP's broadcast information. Channel is 1-11 inclusive. */
  setWifiApBroadcast(mode: 'b' | 'bg' | 'bgn', ssid: string, channel: number, callback: ?(?Error) => void): void {
    this._udpClient.setWifiApBroadcast(mode, ssid, channel, callback);
  }
  /** Sets the UFO's AP passphrase. If null, network will be open. */
  setWifiApPassphrase(passphrase: string | null, callback: ?(?Error) => void): void {
    this._udpClient.setWifiApPassphrase(passphrase, callback);
  }
  /**
   * Sets the UFO AP's connection LED flag. If on, the UFO's blue LED will turn
   * on when any client is connected to the AP.
   */
  setWifiApLed(on: boolean, callback: ?(?Error) => void): void {
    this._udpClient.setWifiApLed(on, callback);
  }
  /**
   * Sets the UFO AP's DHCP address range. Both arguments are 0-254 inclusive.
   * This command implicitly enables the DHCP server.
   */
  setWifiApDhcp(start: number, end: number, callback: ?(?Error) => void): void {
    this._udpClient.setWifiApDhcp(start, end, callback);
  }
  /** Disables the UFO AP's DHCP server. */
  disableWifiApDhcp(callback: ?(?Error) => void): void {
    this._udpClient.disableWifiApDhcp(callback);
  }
  /** Enables DHCP mode for the UFO client. */
  setWifiClientIpDhcp(callback: ?(?Error) => void): void {
    this._udpClient.setWifiClientIpDhcp(callback);
  }
  /** Sets the IP configuration for the UFO client. Implicitly disables DHCP. */
  setWifiClientIpStatic(ip: string, mask: string, gateway: string, callback: ?(?Error) => void): void {
    this._udpClient.setWifiClientIpStatic(ip, mask, gateway, callback);
  }
  /** Sets the UFO client's AP SSID. */
  setWifiClientSsid(ssid: string, callback: ?(?Error) => void): void {
    this._udpClient.setWifiClientSsid(ssid, callback);
  }
  /**
   * Sets the UFO client's AP auth settings.
   * - If auth is OPEN, encryption must be NONE, WEP-H or WEP-A.
   * - If auth is SHARED, encryption must be WEP-H or WEP-A.
   * - If auth is WPAPSK or WPA2PSK, encryption must be TKIP or AES.
   * - If encryption is NONE, paraphrase must be null.
   * - If encryption is WEP-H, paraphrase must be exactly 10 or 26 hexadecimal
   * characters in length.
   * - If encryption is WEP-A, paraphrase must be exactly 5 or 13 ASCII
   * characters in length.
   * - If encryption is TKIP or AES, paraphrase must be 8-63 ASCII characters in
   * length, inclusive.
   */
  setWifiClientAuth(
    auth: 'OPEN' | 'SHARED' | 'WPAPSK' | 'WPA2PSK',
    encryption: 'NONE' | 'WEP-H' | 'WEP-A' | 'TKIP' | 'AES',
    passphrase?: string | null,
    callback: ?(?Error) => void,
  ): void {
    this._udpClient.setWifiClientAuth(auth, encryption, passphrase, callback);
  }
  /*
   * Miscellaneous methods
   */
  /**
   * Reboots the UFO. The owning UFO object will be disconnected after this
   * method is invoked. If a callback is provided to this method, it overrides
   * whatever disconnect callback was defined when the client was constructed.
   */
  reboot(callback?: UfoDisconnectCallback): void {
    this._udpClient.reboot(callback);
  }
  /**
   * Resets the UFO to factory defaults. The owning UFO object will be
   * disconnected after this method is invoked. If a callback is provided to
   * this method, it overrides whatever disconnect callback was defined when the
   * client was constructed.
   */
  factoryReset(callback?: UfoDisconnectCallback): void {
    this._udpClient.factoryReset(callback);
  }
}
export default Ufo;
