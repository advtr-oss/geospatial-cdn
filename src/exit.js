'use strict'

/**
 * @typedef {Error} ExitError
 * @property {string} message - Error message
 * @property {Number} [exitCode] - An error exit code if this is supplied
 * */

/**
 * @param {ExitError|Number} error - Either the error that caused the exit, or an exit code if it's just a standard exit
 * @param {Number} [code=0] - Exit code, defaults to 0 if exit is called with nothing
 * */
module.exports = (error, code = 0) => {
  if (typeof error === 'number') {
    code = error
    error = null
  }

  if (error) {
    console.error(`error: ${error.message}`)
    if (code === 0) code = error.exitCode || 1
  }

  process.exit(code)
}
