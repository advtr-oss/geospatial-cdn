const { promises: fs, constants } = require('fs')

const readFile = async (file) => fs.readFile(file, 'utf-8')

const mkdir = async (dir, options = { recursive: true }) =>
  fs.access(dir, constants.R_OK | constants.W_OK)
    .catch(() => fs.mkdir(dir, options))

module.exports = {
  readFile,
  mkdir
}
