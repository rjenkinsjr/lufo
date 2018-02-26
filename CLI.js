#! /usr/bin/env node
const util = require('util');
const UFO = require('./UFO');
const _ = require('lodash');
const promptly = require('promptly');
const IPv4 = require('ip-address').Address4;

var theUfo = null;
// Helper function for assembling the UFO object based on the given args.
// The UFO object created by this method is bound to "this" in the action callback.
const go = function(action) {
  if (!cli.ufo) {
    cli.ufo = process.env.LUFO_ADDRESS;
  }
  if (cli.ufo) {
    if (new IPv4(cli.ufo).isValid()) {
      var ufoOptions = {
        host: cli.ufo,
        disconnectCallback: function(err) {
          if (err) quitError(error);
        }
      }
      theUfo = new UFO(ufoOptions);
      theUfo.connect(action.bind(theUfo));
    } else {
      quitError(`Invalid UFO IP address provided: ${cli.ufo}.`);
    }
  } else {
    quitError('No UFO IP address provided.');
  }
}
// Helper function to reduce boilerplate when disconnecting the UFO.
const stop = function() {
  return function(err) {
    if (err) quitError(err);
    else theUfo.disconnect();
  };
}
// Helper function to reduce boilerplate when running getter commands.
const getAndStop = function(isJson, transformer) {
  return function(err, value) {
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
  }
}
// Helper function for printing errors and setting the exit code.
const quitError = function(obj) {
  if (_.isError(obj)) {
    console.error(obj);
  } else {
    console.error(`Error: ${obj}`);
  }
  if (theUfo) theUfo.disconnect();
  process.exitCode = 1;
}

// Define core CLI options.
var cli = require('commander');
cli.version(require('^package.json').version)
  .usage('[options] <command> [command-options ...]')
  .option('-u, --ufo <ip>', 'specify UFO IP address; required for all commands except "discover". If unspecified, the LUFO_ADDRESS environment variable is used.');
cli.on('--help', function() {
  console.log('');
  console.log('Commands marked [json] return well-formed JSON to stdout; no commands accept JSON input.');
  console.log('');
});

/*
 * CLI command definitions
 */
// Discover command
const discover = function(args) {
  UFO.discover(args, function(err, data) {
    if (err) quitError(err);
    else console.log(JSON.stringify(data, null, 2));
  });
}
cli.command('discover [timeout]')
  .alias('d')
  .description('Searches for UFOs on the network. Timeout is in milliseconds [json].')
  .option('-p, --password [password]', 'The UDP password used to search for UFOs. If this option is set but has no value, you will be prompted for a password (not suitable for programmatic JSON consumption).')
  .option('-l, --local-port <localPort>', 'The UDP port to use on this computer to search. If unspecified, a random port is used.')
  .option('-r, --remote-port <remotePort>', 'The UDP port to which expected UFOs are bound. Default is 48899.')
  .on('--help', function() { console.log(); })
  .action(function(timeout, options) {
    var discoverArgs = {
      timeout: timeout,
      password: options.password,
      localPort: options.localPort,
      remotePort: options.remotePort
    };
    if (options.password === true) {
      var promptOptions = {
        validator: function (value) {
          if (value.length > 20) throw new Error('Length must be less than 20 characters.');
          return value;
        },
        retry: true,
        silent: true
      };
      promptly.prompt('Password: ', promptOptions, function(err, value) {
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
  .description('Returns the UFO\'s current status [json].')
  .action(function() {
    go(function() {
      this.getStatus(function(err, data) {
        if (err) {
          quitError(err);
        } else {
          console.log(JSON.stringify(data, function(k, v) {
            if (k === 'raw') return undefined;
            else return v;
          }, 2));
          this.disconnect();
        }
      }.bind(this));
    });
  });
cli.command('on')
  .description('Turns on UFO output.')
  .action(function() {
    go(function() {
      this.turnOn(stop());
    });
  });
cli.command('off')
  .description('Turns off UFO output. Does not stop running builtin/custom functions; see "zero" and "freeze" commands.')
  .action(function() {
    go(function() {
      this.turnOff(stop());
    });
  });
cli.command('toggle')
  .alias('t')
  .description('Toggles UFO output on/off.')
  .action(function() {
    go(function() {
      this.togglePower(stop());
    });
  });
cli.command('rgbw <values...>')
  .alias('v')
  .description('Sets the UFO\'s output. Input values are R, G, B and W respectively, range 0-255 inclusive.')
  .action(function(values) {
    if (values.length !== 4) {
      quitError('RGBW takes exactly 4 arguments.');
    } else {
      go(function() {
        this.setColor(...values, stop());
      });
    }
  });
cli.command('red <value>')
  .alias('r')
  .description('Sets the UFO\'s red output. Input range 0-255 inclusive.')
  .option('-s, --solo', 'Turn off all other outputs.')
  .action(function(value, options) {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function() {
        this.setRed(value, options.solo, stop());
      });
    }
  });
cli.command('green <value>')
  .alias('g')
  .description('Sets the UFO\'s green output. Input range 0-255 inclusive.')
  .option('-s, --solo', 'Turn off all other outputs.')
  .action(function(value, options) {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function() {
        this.setGreen(value, options.solo, stop());
      });
    }
  });
cli.command('blue <value>')
  .alias('b')
  .description('Sets the UFO\'s blue output. Input range 0-255 inclusive.')
  .option('-s, --solo', 'Turn off all other outputs.')
  .action(function(value, options) {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function() {
        this.setBlue(value, options.solo, stop());
      });
    }
  });
cli.command('white <value>')
  .alias('w')
  .description('Sets the UFO\'s white output. Input range 0-255 inclusive.')
  .option('-s, --solo', 'Turn off all other outputs.')
  .action(function(value, options) {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function() {
        this.setWhite(value, options.solo, stop());
      });
    }
  });
cli.command('function <name> <speed>')
  .alias('f')
  .description('Plays a built-in function. Speed is 0-100 (slow to fast) inclusive.')
  .action(function(name, speed, options) {
    go(function() {
      this.setBuiltin(name, speed, stop());
    });
  });
cli.command('custom <type> <speed> [steps...]')
  .alias('c')
  .description('Plays a custom function. Type is "gradual", "jumping" or "strobe". Speed is 0-30 (slow to fast) inclusive. Steps are space-separated RGB triplets (each value in the triplet ranges 0-255 inclusive); maximum of 16 steps (extras are ignored).')
  .action(function(type, speed, values, options) {
    var truncatedValues = values.slice(0, 48);
    if (truncatedValues.length % 3 != 0) {
      quitError('Number of step values provided is not divisible by 3.');
    } else {
      var steps = [];
      while (truncatedValues.length) {
        steps.push(truncatedValues.splice(0, 3));
      }
      steps = steps.map(function(step) {
        return {
          red: step[0],
          green: step[1],
          blue: step[2]
        };
      });
      go(function() {
        this.setCustom(type, speed, steps, stop());
      });
    }
  });
cli.command('zero')
  .alias('0')
  .description('Sets all UFO outputs to zero. Does not alter the power flag (see "on"/"off"/"toggle" commands).')
  .action(function() {
    go(function() {
      this.zeroOutput(stop());
    });
  });
cli.command('freeze')
  .alias('z')
  .description('Stops whatever builtin/custom is playing. Output will remain on; use "zero" to stop and turn off output simultaneously.')
  .action(function() {
    go(function() {
      this.freezeOutput(stop());
    });
  });

// Generic management commands
cli.command('version')
  .description('Returns the UFO\'s firmware version.')
  .action(function() {
    go(function() {
      this.getVersion(getAndStop());
    });
  });
cli.command('ntp [server]')
  .description('Gets/sets the NTP server.')
  .action(function(server) {
    go(function() {
      server ? this.setNtpServer(server, stop()) : this.getNtpServer(getAndStop());
    });
  });
cli.command('password [pwd]')
  .description('Gets/sets the UDP password.')
  .action(function(pwd) {
    go(function() {
      pwd ? this.setUdpPassword(pwd, stop()) : this.getUdpPassword(getAndStop());
    });
  });
cli.command('port [port]')
  .description('Gets/sets the TCP port.')
  .action(function(port) {
    go(function() {
      port ? this.setTcpPort(port, stop()) : this.getTcpPort(getAndStop());
    });
  });

// Generic WiFi commands
cli.command('wifi-scan')
  .description('Scans for nearby WiFi networks and returns their channel, SSID, AP MAC address, security config and signal strength [json].')
  .action(function() {
    go(function() {
      this.doWifiScan(getAndStop(true));
    });
  });
cli.command('wifi-auto-switch [mode]')
  .description('Gets/sets the WiFi auto-switch setting. Possible values are (no quotes): "off" (AP mode will never turn on), "on" (AP mode will turn on after 1 minute), "auto" (after 10 minutes), or integers 3-120 inclusive (after X minutes).')
  .action(function(mode) {
    go(function() {
      mode ? this.setWifiAutoSwitch(mode, stop()) : this.getWifiAutoSwitch(getAndStop());
    });
  });
cli.command('wifi-mode [mode]')
  .description('Gets/sets the WiFi mode. Possible values are (no quotes): "AP", "STA" or "APSTA".')
  .action(function(mode) {
    go(function() {
      mode ? this.setWifiMode(mode, stop()) : this.getWifiMode(getAndStop());
    });
  });

// WiFi AP commands
cli.command('wifi-ap-ip [ip] [mask]')
  .description('Gets/sets the IP address/netmask when in AP mode [json].')
  .action(function(ip) {
    go(function() {
      ip ? this.setWifiApIp(ip, mask, stop()) : this.getWifiApIp(getAndStop(true));
    });
  });
cli.command('wifi-ap-broadcast [mode] [ssid] [channel]')
  .description('Gets/sets the WiFi broadcast info when in AP mode [json]. Mode is one of "b", "bg" or "bgn" (no quotes, case insensitive). SSID is 32 characters or less, ASCII only. Channel is 1-11 inclusive.')
  .action(function(mode, ssid, channel) {
    go(function() {
      mode ? this.setWifiApBroadcast('11'+mode.toUpperCase(), ssid, 'CH'+_.clamp(channel, 1, 11), stop()) : this.getWifiApBroadcast(getAndStop(true));
    });
  });
cli.command('wifi-ap-passphrase [pwd]')
  .description('Gets/sets the WiFi passphrase when in AP mode. 8-63 characters inclusive. Use "false" (no quotes) to disable security and configure the AP as an open network.')
  .action(function(pwd) {
    go(function() {
      pwd ? this.setWifiApPassphrase(pwd, stop()) : this.getWifiApPassphrase(getAndStop(false, function(value) { return value === false ? '<No passphrase, open network>' : value; }));
    });
  });
cli.command('wifi-ap-led [value]')
  .description('Gets/sets the connection LED state when in AP mode. Any argument supplied other than "on" (no quotes) implies "off".')
  .action(function(value) {
    go(function() {
      value ? this.setWifiApLed(value === 'on', stop()) : this.getWifiApLed(getAndStop(false, function(value) { return value ? 'on' : 'off'; }));
    });
  });
cli.command('wifi-ap-dhcp [start] [end]')
  .description('Gets/sets the DHCP range when in AP mode. Ranges are 0-254 inclusive. Implicitly enables the DHCP server when setting; use the "wifi-ap-dhcp-disable" command to disable DHCP.')
  .action(function(start, end) {
    go(function() {
      start ? this.setWifiApDhcp(start, end, stop()) : this.getWifiApDhcp(getAndStop(true));
    });
  });
cli.command('wifi-ap-dhcp-disable')
  .description('Disables the DHCP server when in AP mode.')
  .action(function() {
    go(function() {
      this.disableWifiApDhcp(stop());
    });
  });

// WiFi client commands
cli.command('wifi-client-ap-info')
  .description('Shows the connected AP info when in client mode [json].')
  .action(function() {
    go(function() {
      this.getWifiClientApInfo(getAndStop(true));
    });
  });
cli.command('wifi-client-ap-signal')
  .description('Shows the connected AP signal strength when in client mode.')
  .action(function() {
    go(function() {
      this.getWifiClientApSignal(getAndStop(true));
    });
  });
cli.command('wifi-client-ip [ip] [mask] [gateway]')
  .description('Gets/sets the IP configuration when in client mode [json]. To use DHCP, pass only one argument "dhcp" or "DHCP" (no quotes); setting all 3 arguments implies static IP assignment.')
  .action(function(ip, mask, gateway) {
    go(function() {
      if (ip) {
        (ip === 'dhcp' || ip === 'DHCP') ? this.setWifiClientIpDhcp(stop()) : this.setWifiClientIpStatic(ip, mask, gateway, stop());
      } else {
        this.getWifiClientIp(getAndStop(true));
      }
    });
  });
cli.command('wifi-client-ssid [ssid]')
  .description('Gets/sets the SSID when in client mode.')
  .action(function(ssid) {
    go(function() {
      ssid ? this.setWifiClientSsid(ssid, stop()) : this.getWifiClientSsid(getAndStop());
    });
  });
cli.command('wifi-client-auth [auth] [encryption] [passphrase]')
  .description('Gets/sets the authentication parameters when in client mode [json]. WARNING: when getting, credentials are printed in plaintext!')
  .action(function(auth, encryption, passphrase) {
    go(function() {
      if (!auth) {
        this.getWifiClientAuth(getAndStop(true));
        return;
      }
      if (!passphrase) {
        var promptOptions = {
          retry: true,
          silent: true
        };
        promptly.prompt('Passphrase: ', promptOptions, function(err, value) {
          this.setWifiClientAuth(auth, encryption, value, stop());
        }.bind(this));
      } else {
        this.setWifiClientAuth(auth, encryption, passphrase, stop());
      }
    });
  });

// Miscellaneous commands
cli.command('reboot')
  .description('Reboots the UFO.')
  .action(function() {
    go(function() {
      this.reboot();
    });
  });
cli.command('factory-reset')
  .description('Resets the UFO to factory settings. No confirmation prompt will occur; USE CAUTION.')
  .action(function() {
    go(function() {
      this.factoryReset();
    });
  });

// Do not execute subcommands as external processes; rely on defined actions.
cli.executeSubCommand = () => false;
// Parse the CLI args and execute whatever was requested.
var parsedCli = cli.parse(process.argv);
// Show help if no arguments were provided.
if (!parsedCli.args.length) cli.help();
