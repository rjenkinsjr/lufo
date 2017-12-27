#! /usr/bin/env node
process.on('exit', function() {
  // Mainly because help output needs an extra newline.
  console.log('');
});
const util = require('util');
const UFO = require('./UFO');
const _ = require('lodash');
const promptly = require('promptly');
const IPv4 = require('ip-address').Address4;

var theUfo = null;
// Helper function for assembling the UFO object based on the given args.
// The UFO object created by this method is bound to "this" in the action callback.
const go = function(action) {
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
  .option('-u, --ufo <ip>', 'Specify UFO IP address');

/*
 * CLI command definitions
 */
const discover = function(args) {
  UFO.discover(args, function(err, data) {
    if (err) quitError(err);
    else console.log(JSON.stringify(data, null, 2));
  });
}
cli.command('discover [timeout]')
  .alias('d')
  .description('Searches for UFOs on the network. Timeout is in milliseconds.')
  .option('-p, --password [password]', 'The UDP password used to search for UFOs.')
  .option('-l, --local-port <localPort>', 'The UDP port to use on this computer to search.')
  .option('-r, --remote-port <remotePort>', 'The UDP port to which expected UFOs are bound.')
  .action(function(timeout, options) {
    var discoverArgs = {
      timeout: timeout,
      password: options.password,
      localPort: options.localPort,
      remotePort: options.remotePort
    }
    if (options.password === true) {
      var promptOptions = {
        validator: function (value) {
          if (value.length > 20) throw new Error('Length must be less than 20 characters.');
          return value;
        },
        retry: true,
        silent: true
      }
      promptly.prompt('Password: ', promptOptions, function(err, value) {
        discoverArgs.password = value;
        console.log('Searching...');
        discover(discoverArgs);
      });
    } else {
      discover(discoverArgs);
    }
  });
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
cli.command('status')
  .alias('s')
  .description('Returns the UFO\'s current status.')
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
  .description('Turns off UFO output.')
  .action(function() {
    go(function() {
      this.turnOff(stop());
    });
  });
cli.command('rgbw <values...>')
  .alias('set')
  .alias('v')
  .description('Sets the UFO\'s output. Input values are R, G, B and W respectively, range 0-255.')
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
  .description('Sets the UFO\'s red output. Input range 0-255.')
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
  .description('Sets the UFO\'s green output. Input range 0-255.')
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
  .description('Sets the UFO\'s blue output. Input range 0-255.')
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
  .description('Sets the UFO\'s white output. Input range 0-255.')
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
  .alias('x')
  .description('Plays one of the UFO\'s built-in functions. Speed is 0-100 inclusive.')
  .action(function(name, speed, options) {
    go(function() {
      this.setBuiltin(name, speed, stop());
    });
  });
cli.command('custom <type> <speed> [steps...]')
  .alias('c')
  .description('Plays a custom function. Type is "gradual", "jumping" or "strobe". Speed is 0-30 inclusive. Steps are space-separated RGB triplets; total number of values must be divisible by 3.')
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
  .alias('z')
  .description('Sets all UFO outputs to zero.')
  .action(function() {
    go(function() {
      this.zeroOutput(stop());
    });
  });
cli.command('freeze')
  .alias('f')
  .description('Stops whatever builtin/custom is playing.')
  .action(function() {
    go(function() {
      this.freezeOutput(stop());
    });
  });
cli.command('wifi-scan')
  .description('Scan for nearby WiFi networks with the UFO.')
  .action(function() {
    go(function() {
      this.doWifiScan(function(err, result) {
        if (err) {
          quitError(err);
        } else {
          this.disconnect();
          console.log(JSON.stringify(result, null, 2));
        }
      }.bind(this));
    });
  });
cli.command('wifi-mode <mode>')
  .description('Sets the WiFi mode of the UFO.')
  .action(function(mode) {
    go(function() {
      this.setWifiMode(mode, stop());
    });
  });
cli.command('wifi-client-ssid <ssid>')
  .description('Sets the SSID of the UFO when in client mode.')
  .action(function(ssid) {
    go(function() {
      this.setWifiClientSsid(ssid, stop());
    });
  });
cli.command('wifi-client-auth <auth> <encryption> [passphrase]')
  .description('Sets the authentication parameters of the UFO when in client mode.')
  .action(function(auth, encryption, passphrase) {
    go(function() {
      if (!passphrase) {
        var promptOptions = {
          retry: true,
          silent: true
        }
        promptly.prompt('Passphrase: ', promptOptions, function(err, value) {
          console.log(auth);
          console.log(encryption);
          console.log(passphrase);
          this.setWifiClientAuth(auth, encryption, value, stop());
        }.bind(this));
      } else {
        this.setWifiClientAuth(auth, encryption, passphrase, stop());
      }
    });
  });

// Do not execute subcommands as external processes; rely on defined actions.
cli.executeSubCommand = () => false;
// Parse the CLI args and execute whatever was requested.
var parsedCli = cli.parse(process.argv);
// Show help if no arguments were provided.
if (!parsedCli.args.length) cli.help();
