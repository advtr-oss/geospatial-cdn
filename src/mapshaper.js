/**
 * See #1
 *
 * Copied from: https://github.com/mbloch/mapshaper/blob/master/bin/mapshaper
 * */

const exit = require('./exit')

const mapshaper = require('mapshaper')
mapshaper.enableLogging()
mapshaper.runCommands(process.argv.slice(2), exit)
