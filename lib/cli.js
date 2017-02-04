'use strict';

// Require extend for merging settings
const extend = require('extend');

// Require colors (in safe mode) for dynamic logging with color
const colors = require('colors/safe');

// Require command-line-args to parse options from process.argv
const clArgs = require('command-line-args');

// Require command-line-usage to pair with clArgs to display usage info
const getUsage = require('command-line-usage')

// Require readline-sync for easy use of CLI input
const readLineSync = require('readline-sync');

/**
 * Cli Helper Class
 */
class Cli {

  /**
   * Create a Cli object
   * @param {object} settings - The settings for this Cli object
   */
  constructor(settings = {}) {

    // Most things happen here, wrap it all up
    try {

      // Initialize options and settings
      this.options = {};
      this.settings = Object.assign({}, Cli.DEFAULT_SETTINGS); // Copys defaults settings into a NEW OBEJCT

      // Create Cli "alias" functions for reading input
      this.select = readLineSync.keyInSelect;
      this.prompt = readLineSync.question;
      this.confirm = readLineSync.keyInYN;

      // Merge provided settings with defaults
      this.mergeSettings(settings);

      // Enable the logging based on settings
      this.enableLogging();

      // Parse and set options based on settings
      this.setOptions();

    // Catch an exception (Error)
    } catch (e) {

      // If we've already failed, force error output without throwing another Error
      this.options.force = true;

      // Reference to logger function (
      // Verify function exists - thrown Error may have been from enableLogging() function
      const logger = (typeof this.error === 'function' ? this.error : console.error);

      // Print message using logger
      if (typeof e.message === 'string') {
        logger(e.message)

      // Print name using logger
      } else if (typeof e.name === 'string') {
        logger(e.name);

      // Print the entire Error using logger
      } else {
        logger(e);
      }

      // Output the entire error when verbose
      this.debug('Caught Error:', e);

      // Show the help menu & exit the process
      this.showHelp();
    }
    
    // Show the help menu & exit the process
    if (this.options.help) {
      this.showHelp();
    }
  }

  /**
   * Merge settings from constructor with defaults
   * @param {object} settings - The settings for this Cli object
   */
  mergeSettings(settings = {}) {

    // Only attempt to merge objects
    if (typeof settings === 'object') {

      // Loop through all keys in the provided settings object
      Object.keys(settings).forEach(key => {

        // Obtain the value from the current key
        const val = settings[key];

        // If the types of the values match, merge them
        if (typeof this.settings[key] === typeof val) {
          switch(typeof val) {

            // If the value is an object...
            case 'object':
              // If the both the default and the provided value are arrays, concat the two
              if (Array.isArray(this.settings[key]) && Array.isArray(val)) {
                this.settings[key] = this.settings[key].concat(val);

              // If neither of the values are arrays, extend then (recursively)
              } else if (!Array.isArray(this.settings[key]) && !Array.isArray(val)) {
                this.settings[key] = extend(true, this.settings[key], val);

              // Otherwise, we're attempting to merge incompatible settings!
              } else {
                throw new Error(`Cannot override setting: '${key}' ... Type did not match!`);
              }
              break;

            // Otherwise, overwrite the value
            default:
              this.settings[key] = val;
              break;
          }

        // If there was no default, copy the new setting value!
        } else if (typeof this.settings[key] === 'undefined') {
          this.settings[key] = val;
        }
      });
    } else {
      // Throw an Error if settings argument is not an object
      throw new Error('Invalid settings provided to merge function!');
    }
  }

  /**
   * Enable the logging functions as defined by the settings
   */
  enableLogging() {

    // Only attempt to enable logging from an object definition
    if (typeof this.settings.logging === 'object') {

      // Loop through logging settings by method (function name)
      Object.keys(this.settings.logging).forEach(method => {

        // Get the current method configuration from the logging settings by method
        const methodConfig = this.settings.logging[method];

        // Don't allow provided setting to override existing properties
        if (typeof this[method] !== 'undefined') {
          throw new Error(`Cannot override method for logging: '${method}' ... it already exists!`);
        }

        // Create the logging method as a function on the current Cli instance
        this[method] = (...args) => {

          // Determine whether or not to show the message
          //  - If method isn't verbose only OR verbose flag is set
          //  - AND
          //  - The quiet flag is NOT set
          if ((!methodConfig.verbose || this.options.verbose) && !this.options.quiet) {

            // Get the console method to be used for this logging function
            // Check to see if the "console" object has the same function, otherwise just use "log"
            const consoleMethod = (typeof console[method] === 'function' ? console[method] : console['log']);

            // Get the prefix from method config, otherwise set it to blank
            const prefix = (typeof methodConfig.prefix === 'string' ? methodConfig.prefix : '');

            // Get the color from the method config, otherwise set it to blank
            const color = (typeof colors[methodConfig.color] === 'function' ? methodConfig.color : '');

            // Create the output variable
            let output = Cli.colorize(args, color);

            // If a prefix is set, prepend it to the previously created output
            if (prefix.trim() !== '') {
              output = Cli.colorize([prefix], color).concat(output);
            }

            // If the stamp flag is set, prepend the output with a timestamp
            if (methodConfig.stamp) {
              const timeStamp = this.getTimeStamp();
              output = Cli.colorize([`[${timeStamp}]`], color).concat(output);
            }

            // Use the console method obtained above, print the generated output
            consoleMethod(...output);

            // If the throws flag is set, and the force flag isn't allowed AND set
            if (methodConfig.throws === true && !(this.settings.allowForceNoThrow && this.options.force)) {
              // Throw the args as an error
              throw new Error(args);
            }
          }
        }
      });
    }
  }

  /**
   * Set the options from the process argument list (process.argv)
   */
  setOptions() {
    // Set options on this instance using clArgs (command-line-args)
    this.options = clArgs(this.settings.optionDefinitions);
  }

  /**
   * Get parsed CLI options
   */
  getOptions() {
    // Return the options object
    return this.options;
  }

  /**
   * Return the JSON structure for the usage message
   */
  getHelpSections() {
    // Build simple config for command-line-usage module
    return [
      {
        header: this.settings.name,         // String - Main usage screen header
        content: this.settings.description  // String - Main usage screen description
      },
      {
        header: this.settings.helpHeader,           // String - Options header
        optionList: this.settings.optionDefinitions // Array - Option definitions
      }
    ];
  }

  /**
   * Get the current Timestamp
   */
  getTimeStamp() {
    // Create new Date object
    const d = new Date();

    // Return date in the format "M/D/YYYY h:i:s AM/PM"
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  /**
   * Show the help menu & exit
   */
  showHelp() {
    // Use console.log() for help (in case logging hasn't been enabled)
    console.log(getUsage(this.getHelpSections()));

    // Exit the process
    process.exit(0);
  }

  /**
   * Colorize each argument that is a string
   * @param {string|array|object} args - Subject(s) to be colorized
   * @param {string} color - The color (i.e. "red") to make the args
   */
  static colorize(args, color) {
    // Verify the color is not an empty string, and it exists as a functions on the colors object
    if (color.trim() !== '' && typeof colors[color] === 'function') {
      // If the arg passed is a string, just colorize it
      if (typeof args === 'string') {
        args = colors[color](args);

      // If the arg is an object
      } else if (typeof args === 'object') {

        // Check if it's an Array
        if (Array.isArray(args)) {

          // Loop through all items in the array
          args.forEach((arg, i) => {

            // If item is a string, override the item at args[i] with it colorized
            if (typeof arg === 'string') {
              args[i] = colors[color](arg);
            }
          });

        // args is just an object
        } else {

          // Loop through object keys
          Object.keys(args).forEach(key => {

            // If item is a string, override the item at args[key] with it colorized
            if (typeof args[key] === 'string') {
              args[key] = colors[color](args[key]);
            }
          });
        }
      }
    }

    // Return colorized args
    return args;
  }

  /**
   * Return the default settings from JSON file
   */
  static get DEFAULT_SETTINGS() {
    return require('../settings.json');
  }
}

// Export Cli class
module.exports = Cli;