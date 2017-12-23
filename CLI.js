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
// The ufo object created by this method is bound to "this" in the action function.
const ufo = function(action) {
  var ufo;
  if (cli.ufo) {
    if (new IPv4(cli.ufo).isValid()) {
      var ufoOptions = {
        host: cli.ufo,
        disconnectCallback: function(err) {
          if (err) quitError(error);
        }
      }
      ufo = new UFO(ufoOptions);
      ufo.connect(action.bind(ufo));
    } else {
      quitError(`Invalid UFO IP address provided: ${cli.ufo}.`);
    }
  } else {
    quitError('No UFO IP address provided.');
  }
  return ufo;
}

// Helper function to reduce disconnect boilerplate code.
const ufoQuit = function(ufo) {
  return function() { this.disconnect(); }.bind(ufo);
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
  .action(function(values){
    if (values.length !== 4) {
      quitError('RGBW takes exactly 4 arguments.');
    } else {
      ufo(function() {
        this.setColor(...values, ufoQuit(this));
      });
    }
  });

// Do not execute subcommands as external processes; rely on defined actions.
cli.executeSubCommand = () => false;
// Parse the CLI args and execute whatever was requested.
cli.parse(process.argv);
// Show help if no arguments were provided.
if (!process.argv.slice(2).length) cli.help();
