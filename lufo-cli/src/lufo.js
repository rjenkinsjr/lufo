#! /usr/bin/env node
// @lufo
/* eslint no-console: 0 */
import _ from 'lodash';
import promptly from 'promptly';
import { Address4 } from 'ip-address';
import Ufo from 'lufo-api'; // eslint-disable-line

const cli = require('commander');

let theUfo = null;
// Helper function for printing errors and setting the exit code.
const quitError = function (obj) {
  if (_.isError(obj)) {
    console.error(obj);
  } else {
    console.error(`Error: ${obj}`);
  }
  if (theUfo) theUfo.disconnect();
  process.exitCode = 1;
};
// Helper function to construct a UfoOptions object.
const getOptions = function () {
  return {
    host: cli.ufo || process.env.LUFO_ADDRESS,
    password: cli.password || process.env.LUFO_PASSWORD || undefined,
    localHost: cli.localHost || process.env.LUFO_LOCALHOST || undefined,
    localUdpPort: cli.localUdpPort || process.env.LUFO_LOCAL_UDP || undefined,
    remoteUdpPort: cli.remoteUdpPort || process.env.LUFO_REMOTE_UDP || undefined,
    localTcpPort: cli.localTcpPort || process.env.LUFO_LOCAL_TCP || undefined,
    remoteTcpPort: cli.remoteTcpPort || process.env.LUFO_REMOTE_TCP || undefined,
    immediate: cli.immediate || process.env.LUFO_IMMEDIATE || undefined,
  };
};
// Helper function for assembling the UFO object based on the given args.
// The UFO object created by this method is bound to "this" in the action callback.
const go = function (action) {
  const cliOptions = getOptions();
  if (cliOptions.host) {
    if (new Address4(cliOptions.host).isValid()) {
      cliOptions.disconnectCallback = (err) => {
        if (err) quitError(err);
      };
      theUfo = new Ufo(cliOptions);
      theUfo.connect(action.bind(theUfo));
    } else {
      quitError(`Invalid UFO IP address provided: ${cliOptions.host}.`);
    }
  } else {
    quitError('No UFO IP address provided.');
  }
};
// Helper function to reduce boilerplate when disconnecting the UFO.
const stop = function () {
  return function (err) {
    if (err) quitError(err);
    else theUfo.disconnect();
  };
};
// Helper function to reduce boilerplate when running getter commands.
const getAndStop = function (isJson, transformer) {
  return function (err, value) {
    if (err) {
      quitError(err);
    } else {
      if (isJson) {
        console.log(JSON.stringify(value, null, 2));
      } else if (typeof transformer === 'function') {
        console.log(transformer(value));
      } else {
        console.log(value);
      }
      theUfo.disconnect();
    }
  };
};

// Define core CLI options.
cli.version(require(`${__dirname}/../package.json`).version) // eslint-disable-line import/no-dynamic-require
  .usage('[options] <command> [command-options ...]')
  .option('-o, --ufo <ip>', 'The UFO IP address; required for all commands except "discover" and "function-list". If unspecified, the LUFO_ADDRESS environment variable is used.')
  .option('-p, --password [password]', 'The UFO password. If set but with no value, you will be prompted. If unspecified, the LUFO_PASSWORD environment variable is used, or otherwise the default hardcoded password is used.')
  .option('--local-host <localHost>', 'The local host to use when opening the listener ports. If unspecified, the LUFO_LOCALHOST environment variable is used.')
  .option('--local-udp <localUdpPort>', 'The UDP port to use on this computer to search. If unspecified, the LUFO_LOCAL_UDP environment variable, or otherwise a random port is used.')
  .option('-u, --remote-udp <remoteUdpPort>', 'The UDP port to which expected UFOs are bound. If unspecified, the LUFO_REMOTE_UDP environment variable is used, or otherwise the default port 48899 is used.')
  .option('--local-tcp <localTcpPort>', 'The TCP port to use on this computer to search. If unspecified, the LUFO_LOCAL_TCP environment variable, or otherwise a random port is used.')
  .option('-t, --remote-tcp <remoteTcpPort>', 'The TCP port to which expected UFOs are bound. If unspecified, the LUFO_REMOTE_TCP environment variable is used, or otherwise the default port 5577 is used.')
  .option('-i, --immediate', 'If enabled, send TCP data immediately; otherwise, the CLI may buffer data before it is sent. If unspecified, the LUFO_IMMEDIATE environment variable is used, or otherwise it is enabled by default.');
cli.on('--help', () => {
  console.log('');
  console.log('Commands marked {json} return well-formed JSON to stdout; no commands accept JSON input.');
  console.log('');
});

/*
 * CLI command definitions
 */
// Discover command
const discover = function (args) {
  Ufo.discover(args, (err, data) => {
    if (err) quitError(err);
    else console.log(JSON.stringify(data, null, 2));
  });
};
cli.command('discover [timeout]')
  .alias('d')
  .description('Searches for UFOs on the network. Timeout is in seconds, defaults to 3. {json}')
  .on('--help', () => { console.log(); })
  .action((timeout, options) => { // eslint-disable-line no-unused-vars
    const cliOptions = getOptions();
    const discoverArgs = {
      timeout: timeout * 1000,
      password: cliOptions.password,
      remotePort: cliOptions.remoteUdpPort,
      localPort: cliOptions.localUdpPort,
      localAddress: cliOptions.localHost,
    };
    if (discoverArgs.password === true) {
      const promptOptions = {
        validator(value) {
          if (value.length > 20) throw new Error('Length must be less than 20 characters.');
          return value;
        },
        retry: true,
        silent: true,
      };
      promptly.prompt('Password: ', promptOptions, (err, value) => {
        discoverArgs.password = value;
        console.log('Searching...');
        discover(discoverArgs);
      });
    } else {
      discover(discoverArgs);
    }
  });

// Output commands
cli.command('status')
  .alias('s')
  .description('Returns the UFO\'s current status. {json}')
  .action(() => {
    go(function () {
      this.getStatus((err, data) => {
        if (err) {
          quitError(err);
        } else {
          console.log(JSON.stringify(data, (k, v) => {
            if (k === 'raw') return undefined;
            return v;
          }, 2));
          this.disconnect();
        }
      });
    });
  });
cli.command('on')
  .description('Turns on UFO output.')
  .action(() => {
    go(function () {
      this.turnOn(stop());
    });
  });
cli.command('off')
  .description('Turns off UFO output. Does not stop running builtin/custom functions; see "zero" and "freeze" commands.')
  .action(() => {
    go(function () {
      this.turnOff(stop());
    });
  });
cli.command('toggle')
  .alias('t')
  .description('Toggles UFO output on/off.')
  .action(() => {
    go(function () {
      this.togglePower(stop());
    });
  });
cli.command('rgbw <values...>')
  .alias('v')
  .description('Sets the UFO\'s output. Input values are R, G, B and W respectively, range 0-255 inclusive.')
  .action((values) => {
    if (values.length !== 4) {
      quitError('RGBW takes exactly 4 arguments.');
    } else {
      go(function () {
        this.setColor(...values, stop());
      });
    }
  });
cli.command('red <value>')
  .alias('r')
  .description('Sets the UFO\'s red output. Input range 0-255 inclusive.')
  .option('-s, --solo', 'Turn off all other outputs.')
  .action((value, options) => {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function () {
        this.setRed(value, options.solo, stop());
      });
    }
  });
cli.command('green <value>')
  .alias('g')
  .description('Sets the UFO\'s green output. Input range 0-255 inclusive.')
  .option('-s, --solo', 'Turn off all other outputs.')
  .action((value, options) => {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function () {
        this.setGreen(value, options.solo, stop());
      });
    }
  });
cli.command('blue <value>')
  .alias('b')
  .description('Sets the UFO\'s blue output. Input range 0-255 inclusive.')
  .option('-s, --solo', 'Turn off all other outputs.')
  .action((value, options) => {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function () {
        this.setBlue(value, options.solo, stop());
      });
    }
  });
cli.command('white <value>')
  .alias('w')
  .description('Sets the UFO\'s white output. Input range 0-255 inclusive.')
  .option('-s, --solo', 'Turn off all other outputs.')
  .action((value, options) => {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function () {
        this.setWhite(value, options.solo, stop());
      });
    }
  });
cli.command('function <name> <speed>')
  .alias('f')
  .description('Plays a built-in function. Speed is 0-100 (slow to fast) inclusive.')
  .action((name, speed, options) => { // eslint-disable-line no-unused-vars
    go(function () {
      this.setBuiltin(name, speed, stop());
    });
  });
cli.command('function-list')
  .description('Lists all possible built-in function names usable by the "function" command.')
  .action(() => {
    console.log(Ufo.getBuiltinFunctions().join(', '));
  });
cli.command('custom <type> <speed> [steps...]')
  .alias('c')
  .description('Plays a custom function. Type is "gradual", "jumping" or "strobe". Speed is 0-30 (slow to fast) inclusive. Each step is a comma-separated RGB triplets (each value in the triplet ranges 0-255 inclusive); maximum of 16 steps (extras are ignored).')
  .action((type, speed, values, options) => { // eslint-disable-line no-unused-vars
    const steps = [];
    values.forEach((v) => {
      const splitV = v.split(',');
      const newValue = {
        red: parseInt(splitV[0], 10),
        green: parseInt(splitV[1], 10),
        blue: parseInt(splitV[2], 10),
      };
      if (!Ufo.isNullStep(newValue)) steps.push(newValue);
    });
    go(function () {
      this.setCustom(type, speed, steps, stop());
    });
  });
cli.command('zero')
  .alias('0')
  .description('Sets all UFO outputs to zero. Does not alter the power flag (see "on"/"off"/"toggle" commands).')
  .action(() => {
    go(function () {
      this.zeroOutput(stop());
    });
  });
cli.command('freeze')
  .alias('z')
  .description('Stops whatever builtin/custom is playing. Output will remain on; use "zero" to stop and turn off output simultaneously.')
  .action(() => {
    go(function () {
      this.freezeOutput(stop());
    });
  });

// Generic management commands
cli.command('version')
  .description('Returns the UFO\'s firmware version.')
  .action(() => {
    go(function () {
      this.getVersion(getAndStop());
    });
  });
cli.command('ntp [server]')
  .description('Gets/sets the NTP server.')
  .action((server) => {
    go(function () {
      if (server) this.setNtpServer(server, stop());
      else this.getNtpServer(getAndStop());
    });
  });
cli.command('password <pwd>')
  .description('Sets the UDP password.')
  .action((pwd) => {
    go(function () {
      if (pwd) this.setUdpPassword(pwd, stop());
      else quitError(new Error('No password provided.'));
    });
  });
cli.command('port <port>')
  .description('Sets the TCP port.')
  .action((port) => {
    go(function () {
      if (port) this.setTcpPort(port, stop());
      else quitError(new Error('No port provided.'));
    });
  });

// Generic WiFi commands
cli.command('wifi-scan')
  .description('Scans for nearby WiFi networks and returns their channel, SSID, AP MAC address, security config and signal strength. {json}')
  .action(() => {
    go(function () {
      this.doWifiScan(getAndStop(true));
    });
  });
cli.command('wifi-auto-switch [mode]')
  .description('Gets/sets the WiFi auto-switch setting. Possible values are (no quotes): "off" (AP mode will never turn on), "on" (AP mode will turn on after 1 minute), "auto" (after 10 minutes), or integers 3-120 inclusive (after X minutes).')
  .action((mode) => {
    go(function () {
      if (mode) this.setWifiAutoSwitch(mode, stop());
      else this.getWifiAutoSwitch(getAndStop());
    });
  });
cli.command('wifi-mode [mode]')
  .description('Gets/sets the WiFi mode. Possible values are (no quotes): "AP", "STA" or "APSTA".')
  .action((mode) => {
    go(function () {
      if (mode) this.setWifiMode(mode, stop());
      else this.getWifiMode(getAndStop());
    });
  });

// WiFi AP commands
cli.command('wifi-ap-ip [ip] [mask]')
  .description('Gets/sets the IP address/netmask when in AP mode. {json}')
  .action((ip, mask) => {
    go(function () {
      if (ip) this.setWifiApIp(ip, mask, stop());
      else this.getWifiApIp(getAndStop(true));
    });
  });
cli.command('wifi-ap-broadcast [mode] [ssid] [channel]')
  .description('Gets/sets the WiFi broadcast info when in AP mode. {json} Mode is one of "b", "bg" or "bgn" (no quotes, case insensitive). SSID is 32 characters or less, ASCII only. Channel is 1-11 inclusive.')
  .action((mode, ssid, channel) => {
    go(function () {
      if (mode) this.setWifiApBroadcast(`11${mode.toUpperCase()}`, ssid, `CH${_.clamp(channel, 1, 11)}`, stop());
      else this.getWifiApBroadcast(getAndStop(true));
    });
  });
cli.command('wifi-ap-passphrase [pwd]')
  .description('Gets/sets the WiFi passphrase when in AP mode. 8-63 characters inclusive. Use "false" (no quotes) to disable security and configure the AP as an open network.')
  .action((pwd) => {
    go(function () {
      if (pwd) this.setWifiApPassphrase(pwd.toLowerCase() === 'false' ? null : pwd, stop());
      else this.getWifiApPassphrase(getAndStop(false, value => (value || '<No passphrase, open network>')));
    });
  });
cli.command('wifi-ap-led [value]')
  .description('Gets/sets the connection LED state when in AP mode. Any argument supplied other than "on" (no quotes) implies "off".')
  .action((value) => {
    go(function () {
      if (value) this.setWifiApLed(value === 'on', stop());
      else this.getWifiApLed(getAndStop(false, flag => (flag ? 'on' : 'off')));
    });
  });
cli.command('wifi-ap-dhcp [start] [end]')
  .description('Gets/sets the DHCP range when in AP mode. Ranges are 0-254 inclusive. Implicitly enables the DHCP server when setting; use the "wifi-ap-dhcp-disable" command to disable DHCP.')
  .action((start, end) => {
    go(function () {
      if (start) this.setWifiApDhcp(start, end, stop());
      else this.getWifiApDhcp(getAndStop(true));
    });
  });
cli.command('wifi-ap-dhcp-disable')
  .description('Disables the DHCP server when in AP mode.')
  .action(() => {
    go(function () {
      this.disableWifiApDhcp(stop());
    });
  });

// WiFi client commands
cli.command('wifi-client-ap-info')
  .description('Shows the connected AP\'s SSID/MAC address when in client mode. {json}')
  .action(() => {
    go(function () {
      this.getWifiClientApInfo(getAndStop(true));
    });
  });
cli.command('wifi-client-ap-signal')
  .description('Shows the connected AP signal strength when in client mode.')
  .action(() => {
    go(function () {
      this.getWifiClientApSignal(getAndStop(true));
    });
  });
cli.command('wifi-client-ip [ip] [mask] [gateway]')
  .description('Gets/sets the IP configuration when in client mode. {json} To use DHCP, pass only one argument "dhcp" or "DHCP" (no quotes); setting all 3 arguments implies static IP assignment.')
  .action((ip, mask, gateway) => {
    go(function () {
      if (ip) {
        if ((ip === 'dhcp' || ip === 'DHCP')) this.setWifiClientIpDhcp(stop());
        else this.setWifiClientIpStatic(ip, mask, gateway, stop());
      } else {
        this.getWifiClientIp(getAndStop(true));
      }
    });
  });
cli.command('wifi-client-ssid [ssid]')
  .description('Gets/sets the SSID when in client mode.')
  .action((ssid) => {
    go(function () {
      if (ssid) this.setWifiClientSsid(ssid, stop());
      else this.getWifiClientSsid(getAndStop());
    });
  });
cli.command('wifi-client-auth [auth] [encryption] [passphrase]')
  .description('Gets/sets the authentication parameters when in client mode. {json} WARNING: when getting, credentials are printed in plaintext!')
  .action((auth, encryption, passphrase) => {
    go(function () {
      if (!auth) {
        this.getWifiClientAuth(getAndStop(true));
        return;
      }
      if (!passphrase) {
        const promptOptions = {
          retry: true,
          silent: true,
        };
        promptly.prompt('Passphrase: ', promptOptions, (err, value) => {
          this.setWifiClientAuth(auth, encryption, value, stop());
        });
      } else {
        this.setWifiClientAuth(auth, encryption, passphrase, stop());
      }
    });
  });

// Miscellaneous commands
cli.command('reboot')
  .description('Reboots the UFO.')
  .action(() => {
    go(function () {
      this.reboot();
    });
  });
cli.command('factory-reset')
  .description('Resets the UFO to factory settings. No confirmation prompt will occur; USE CAUTION.')
  .action(() => {
    go(function () {
      this.factoryReset();
    });
  });

// Do not execute subcommands as external processes; rely on defined actions.
cli.executeSubCommand = () => false;
// Parse the CLI args and execute whatever was requested.
const parsedCli = cli.parse(process.argv);
// Show help if no arguments were provided.
if (parsedCli.args && !parsedCli.args.length) cli.help();
