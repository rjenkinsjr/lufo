#! /usr/bin/env node
const util = require('util');
const UFO = require('./UFO');
const _ = require('lodash');
const IPv4 = require('ip-address').Address4;

// Helper function for printing errors and setting the exit code.
const quitError = function(obj) {
  if (_.isError(obj)) {
    console.error(obj);
  } else {
    console.error(`Error: ${obj}`);
  }
  process.exitCode = 1;
}

// Helper function for assembling the UFO object based on the given args.
// The UFO object created by this method is bound to "this" in the action callback.
var theUfo = null;
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
  return function() { this.disconnect(); }.bind(theUfo);
}

// Define core CLI options.
var cli = require('commander');
cli.version(require('^package.json').version)
  .usage('[options] <command> [command-options ...]')
  .option('-u, --ufo <ip>', 'Specify UFO IP address');

/*
 * CLI command definitions
 */
cli.command('rgbw <values...>')
  .alias('set')
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
  .option('-s, --solo', 'Turn off all other outputs')
  .action(function(value, options) {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function() {
        this.setRed(value, options.solo, function(err, data) {
          if (err) quitError(error);
          else this.disconnect();
        }.bind(this));
      });
    }
  });
cli.command('green <value>')
  .alias('g')
  .description('Sets the UFO\'s green output. Input range 0-255.')
  .option('-s, --solo', 'Turn off all other outputs')
  .action(function(value, options) {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function() {
        this.setGreen(value, options.solo, function(err, data) {
          if (err) quitError(error);
          else this.disconnect();
        }.bind(this));
      });
    }
  });
cli.command('blue <value>')
  .alias('b')
  .description('Sets the UFO\'s blue output. Input range 0-255.')
  .option('-s, --solo', 'Turn off all other outputs')
  .action(function(value, options) {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function() {
        this.setBlue(value, options.solo, function(err, data) {
          if (err) quitError(error);
          else this.disconnect();
        }.bind(this));
      });
    }
  });
cli.command('white <value>')
  .alias('w')
  .description('Sets the UFO\'s white output. Input range 0-255.')
  .option('-s, --solo', 'Turn off all other outputs')
  .action(function(value, options) {
    if (!value) {
      quitError('No value provided.');
    } else {
      go(function() {
        this.setWhite(value, options.solo, function(err, data) {
          if (err) quitError(error);
          else this.disconnect();
        }.bind(this));
      });
    }
  });

// Do not execute subcommands as external processes; rely on defined actions.
cli.executeSubCommand = () => false;
// Parse the CLI args and execute whatever was requested.
cli.parse(process.argv);
// Show help if no arguments were provided.
if (!process.argv.slice(2).length) cli.help();
