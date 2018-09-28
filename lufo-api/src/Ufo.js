// @flow
import { TcpClient } from './TcpClient';
import type { BuiltinFunction, CustomMode, CustomStep, UfoStatus } from './TcpClient';
import { UdpClient } from './UdpClient';
import type { DiscoveredUfo, UfoDiscoverOptions, WifiNetwork } from './UdpClient';
import type { UfoOptions } from './UfoOptions';

/**
 * Errors of this type are thrown when communication with a UFO fails. The error
 * object contains a message and an optional error from the UDP and TCP sockets
 * that may have contributed to this error.
 */
class UfoDisconnectError extends Error { // eslint-disable-line import/prefer-default-export
  udpError: ?Error;
  tcpError: ?Error;
  constructor(message: string, udpError: ?Error, tcpError: ?Error) {
    super(message);
    Error.captureStackTrace(this, UfoDisconnectError);
    this.udpError = udpError;
    this.tcpError = tcpError;
  }
}

/** The API for interfacing with UFO devices. */
class Ufo {
  _dead: boolean;
  _options: UfoOptions;
  _disconnectCallback: ?Function;
  _tcpClient: TcpClient;
  _udpClient: UdpClient;
  _tcpError: ?Error;
  _udpError: ?Error;
  constructor(options: UfoOptions) {
    // Flag that tracks the state of this UFO object.
    this._dead = false;
    // Capture the options provided by the user.
    this._options = Object.freeze(options);
    // Create the TCP and UDP clients.
    this._tcpClient = new TcpClient(this, options);
    this._udpClient = new UdpClient(this, options);
    // Define the "client is dead" flag variables.
    this._tcpError = null;
    this._udpError = null;
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
   * Dead handling methods.
   */
  /**
   * Called by {@link TcpClient} when it dies.
   * @private
   */
  _onTcpDead(deadData: {error: ?Error, callback: ?Function}): void {
    this._dead = true;
    this._tcpError = deadData.error;
    if (!this._disconnectCallback) this._disconnectCallback = deadData.callback;
    if (this._udpClient._dead) {
      this._onUfoDead();
    } else {
      this._udpClient.disconnect();
    }
  }
  /**
   * Called by {@link UdpClient} when it dies.
   * @private
   */
  _onUdpDead(deadData: {error: ?Error, callback: ?Function}): void {
    this._dead = true;
    this._udpError = deadData.error;
    if (!this._disconnectCallback) this._disconnectCallback = deadData.callback;
    if (this._tcpClient._dead) {
      this._onUfoDead();
    } else {
      this._tcpClient.disconnect();
    }
  }
  /**
   * Called by _onTcpDead or _onUdpDead once both clients are dead.
   * @private
   */
  _onUfoDead(): void {
    // Invoke the disconnect callback, if one is defined.
    let error = null;
    if (this._udpError || this._tcpError) {
      error = new UfoDisconnectError('UFO disconnected due to an error.', this._udpError, this._tcpError);
    }
    const dc = this._disconnectCallback;
    if (dc) dc(error);
  }
  /*
   * Connect/disconnect methods
   */
  /**
   * Establishes a connection to the UFO. If this method fails, it is safe to
   * retry connecting unless the error implies that retrying is not appropriate.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._udpClient.connect().then(() => {
        this._tcpClient.connect().then(resolve).catch(reject);
      }).catch(reject);
    });
  }
  /**
   * Disconnects from the UFO. After disconnecting, this object cannot be used;
   * you must construct a new {@link Ufo} object to reconnect.
   *
   * If a callback is provided, it is called once disconnect is finished and
   * this function returns null. Otherwise, a promise is returned that will
   * be resolved once disconnect is finished (this promise will never be
   * rejected).
   */
  disconnect(cb?: Function): ?Promise<void> {
    if (typeof cb === 'undefined') {
      return new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
        if (this._dead) { resolve(); }
        this._dead = true;
        this._disconnectCallback = resolve;
        this._udpClient.disconnect();
        this._tcpClient.disconnect();
      });
    }
    if (this._dead) { cb(); return null; }
    this._dead = true;
    this._disconnectCallback = cb;
    this._udpClient.disconnect();
    this._tcpClient.disconnect();
    return null;
  }
  /*
   * Query methods
   */
  /**
   * Gets the UFO's output status. If force is true, status cache is ignored.
   * Result is null iff this UFO object is dead.
   */
  getStatus(force: boolean = false): Promise<?UfoStatus> {
    return this._tcpClient.status(force);
  }
  /*
   * RGBW control methods
   */
  /** Sets the UFO's output flag to the given value. */
  setPower(on: boolean): Promise<void> {
    return on ? this.turnOn() : this.turnOff();
  }
  /** Turns the UFO on. */
  turnOn(): Promise<void> {
    return this._tcpClient.on();
  }
  /** Turns the UFO off. */
  turnOff(): Promise<void> {
    return this._tcpClient.off();
  }
  /** Toggle the UFO's output flag. */
  togglePower(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getStatus().then((status) => {
        if (status) {
          const result = status.on ? this.turnOff() : this.turnOn();
          result.then(resolve).catch(reject);
        } else {
          reject(new Error('Status object is null.'));
        }
      }).catch(reject);
    });
  }
  /**
   * Sets the UFO output to the static values specified. The RGBW values are
   * clamped from 0-255 inclusive, where 0 is off and 255 is fully on/100% output.
   */
  setColor(red: number, green: number, blue: number, white: number): Promise<void> {
    return this._tcpClient.rgbw(red, green, blue, white);
  }
  /**
   * Sets the red output value. If solo is true, all other output values are set
   * to zero. Input value is clamped to 0-255 inclusive.
   */
  setRed(value: number, solo: boolean): Promise<void> {
    return this._setSingle(0, value, solo);
  }
  /**
   * Sets the green output value. If solo is true, all other output values are
   * set to zero. Input value is clamped to 0-255 inclusive.
   */
  setGreen(value: number, solo: boolean): Promise<void> {
    return this._setSingle(1, value, solo);
  }
  /**
   * Sets the blue output value. If solo is true, all other output values are
   * set to zero. Input value is clamped to 0-255 inclusive.
   */
  setBlue(value: number, solo: boolean): Promise<void> {
    return this._setSingle(2, value, solo);
  }
  /**
   * Sets the white output value. If solo is true, all other output values are
   * set to zero. Input value is clamped to 0-255 inclusive.
   */
  setWhite(value: number, solo: boolean): Promise<void> {
    return this._setSingle(3, value, solo);
  }
  /**
   * Sets the given position in the RGBW byte array. If solo is true, all other
   * output values are set to zero. Input value is clamped to 0-255 inclusive.
   * @private
   */
  _setSingle(position: number, value: number, solo: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (solo) {
        const values = [0, 0, 0, 0];
        values[position] = value;
        this.setColor(...values).then(resolve).catch(reject);
      } else {
        this.getStatus().then((status) => {
          if (status) {
            const values = [status.red, status.green, status.blue, status.white];
            values[position] = value;
            this.setColor(...values).then(resolve).catch(reject);
          } else {
            reject(new Error('Status object is null.'));
          }
        }).catch(reject);
      }
    });
  }
  /**
   * Starts one of the UFO's built-in functions at the given speed. The promise
   * will be rejected if an invalid function name is given.
   *
   * The speed is clamped from 0-100 inclusive. Speed values do not result in
   * the same durations across all functions (e.g. sevenColorStrobeFlash is
   * much faster at speed 100 than sevenColorJumpingChange); you will need to
   * experiment with different values to get the desired timing for the function
   * you wish to use.
   */
  setBuiltin(name: BuiltinFunction, speed: number): Promise<void> {
    return this._tcpClient.builtin(name, speed);
  }
  /**
   * Starts the given custom function. The promise will be rejected if an
   * invalid mode is given.
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
  setCustom(mode: CustomMode, speed: number, steps: Array<CustomStep>): Promise<void> {
    return this._tcpClient.custom(mode, speed, steps);
  }
  /**
   * Freezes the playback of whatever built-in or custom function is currently
   * running. The output remains on after being frozen.
   */
  freezeOutput(): Promise<void> {
    return this.setBuiltin('noFunction', 0);
  }
  /** Sets all output to zero. */
  zeroOutput(): Promise<void> {
    return this.setColor(0, 0, 0, 0);
  }
  /*
   * UFO configuration getter methods
   */
  /** Returns the UFO's hardware/firmware version. */
  getVersion(): Promise<null | string> {
    return this._udpClient.getVersion();
  }
  /** Returns the UFO's NTP server IP address. */
  getNtpServer(): Promise<null | string> {
    return this._udpClient.getNtpServer();
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
  getWifiAutoSwitch(): Promise<null | string> {
    return this._udpClient.getWifiAutoSwitch();
  }
  /**
   * Returns the UFO's WiFi mode:
   * - "AP" (AP mode)
   * - "STA" (client mode)
   * - "APSTA" (client and AP mode)
   */
  getWifiMode(): Promise<null | string> {
    return this._udpClient.getWifiMode();
  }
  /** Performs a WiFi AP scan from the UFO and returns the results. */
  doWifiScan(): Promise<null | Array<WifiNetwork>> {
    return this._udpClient.doWifiScan();
  }
  /** Returns the IP address and netmask of the UFO AP. */
  getWifiApIp(): Promise<null | {ip: string, mask: string}> {
    return this._udpClient.getWifiApIp();
  }
  /** Returns the UFO AP's broadcast information. Channel is 1-11 inclusive. */
  getWifiApBroadcast(): Promise<null | {mode: 'b' | 'bg' | 'bgn', ssid: string, channel: number}> {
    return this._udpClient.getWifiApBroadcast();
  }
  /** Returns the UFO AP's passphrase. If null, AP network is open. */
  getWifiApPassphrase(): Promise<null | string> {
    return this._udpClient.getWifiApPassphrase();
  }
  /**
   * Returns the UFO AP's connection LED flag. If on, the UFO's blue LED will
   * turn on when any client is connected to the AP.
   */
  getWifiApLed(): Promise<null | boolean> {
    return this._udpClient.getWifiApLed();
  }
  /**
   * Returns the UFO AP's DHCP server settings. If DHCP is on, the returned
   * object's "start" and "end" properties will be 0-254 inclusive.
   */
  getWifiApDhcp(): Promise<null | {on: boolean, start?: number, end?: number}> {
    return this._udpClient.getWifiApDhcp();
  }
  /**
   * Returns the UFO client's AP SSID and MAC address. If the UFO is not
   * connected to any AP, the returned object will be null.
   */
  getWifiClientApInfo(): Promise<null | {ssid: string, mac: string}> {
    return this._udpClient.getWifiClientApInfo();
  }
  /** Returns the UFO client's AP signal strength, as seen by the UFO. */
  getWifiClientApSignal(): Promise<null | string> {
    return this._udpClient.getWifiClientApSignal();
  }
  /** Returns the UFO client's IP configuration. */
  getWifiClientIp(): Promise<null | {dhcp: boolean, ip: string, mask: string, gateway: string}> {
    return this._udpClient.getWifiClientIp();
  }
  /** Returns the UFO client's AP SSID. */
  getWifiClientSsid(): Promise<null | string> {
    return this._udpClient.getWifiClientSsid();
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
  getWifiClientAuth(): Promise<null | {auth: string, encryption: string, passphrase: string | null}> {
    return this._udpClient.getWifiClientAuth();
  }
  /*
   * UFO configuration setter methods
   */
  /** Sets the NTP server IP address. */
  setNtpServer(ipAddress: string): Promise<void> {
    return this._udpClient.setNtpServer(ipAddress);
  }
  /**
   * Sets the UFO's UDP password. If an error occurs while executing this
   * command, the owning UFO object will be disconnected.
   */
  setUdpPassword(password: string): Promise<void> {
    return this._udpClient.setUdpPassword(password);
  }
  /**
   * Sets the UFO's TCP port. The owning UFO object will be disconnected after
   * this method is invoked.
   */
  setTcpPort(port: number): Promise<void> {
    return this._udpClient.setTcpPort(port);
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
  setWifiAutoSwitch(value: 'off' | 'on' | 'auto' | number): Promise<void> {
    return this._udpClient.setWifiAutoSwitch(value);
  }
  /**
   * Sets the UFO's WiFi mode:
   * - "AP" (AP mode)
   * - "STA" (client mode)
   * - "APSTA" (client and AP mode)
   */
  setWifiMode(mode: 'AP' | 'STA' | 'APSTA'): Promise<void> {
    return this._udpClient.setWifiMode(mode);
  }
  /** Sets the IP address and netmask of the UFO AP. */
  setWifiApIp(ip: string, mask: string): Promise<void> {
    return this._udpClient.setWifiApIp(ip, mask);
  }
  /** Sets the UFO AP's broadcast information. Channel is 1-11 inclusive. */
  setWifiApBroadcast(mode: 'b' | 'bg' | 'bgn', ssid: string, channel: number): Promise<void> {
    return this._udpClient.setWifiApBroadcast(mode, ssid, channel);
  }
  /** Sets the UFO's AP passphrase. If null, network will be open. */
  setWifiApPassphrase(passphrase: string | null): Promise<void> {
    return this._udpClient.setWifiApPassphrase(passphrase);
  }
  /**
   * Sets the UFO AP's connection LED flag. If on, the UFO's blue LED will turn
   * on when any client is connected to the AP.
   */
  setWifiApLed(on: boolean): Promise<void> {
    return this._udpClient.setWifiApLed(on);
  }
  /**
   * Sets the UFO AP's DHCP address range. Both arguments are 0-254 inclusive.
   * This command implicitly enables the DHCP server.
   */
  setWifiApDhcp(start: number, end: number): Promise<void> {
    return this._udpClient.setWifiApDhcp(start, end);
  }
  /** Disables the UFO AP's DHCP server. */
  disableWifiApDhcp(): Promise<void> {
    return this._udpClient.disableWifiApDhcp();
  }
  /** Enables DHCP mode for the UFO client. */
  setWifiClientIpDhcp(): Promise<void> {
    return this._udpClient.setWifiClientIpDhcp();
  }
  /** Sets the IP configuration for the UFO client. Implicitly disables DHCP. */
  setWifiClientIpStatic(ip: string, mask: string, gateway: string): Promise<void> {
    return this._udpClient.setWifiClientIpStatic(ip, mask, gateway);
  }
  /** Sets the UFO client's AP SSID. */
  setWifiClientSsid(ssid: string): Promise<void> {
    return this._udpClient.setWifiClientSsid(ssid);
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
  ): Promise<void> {
    return this._udpClient.setWifiClientAuth(auth, encryption, passphrase);
  }
  /*
   * Miscellaneous methods
   */
  /**
   * Reboots the UFO. The owning UFO object will be disconnected after this
   * method is invoked.
   */
  reboot(): Promise<void> {
    return this._udpClient.reboot();
  }
  /**
   * Resets the UFO to factory defaults. The owning UFO object will be
   * disconnected after this method is invoked.
   */
  factoryReset(): Promise<void> {
    return this._udpClient.factoryReset();
  }
}
export default Ufo;
