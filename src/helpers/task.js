const animateProgress = require('./progress')
const addCheckmark = require('./checkmark')

const newLine = () => process.stdout.write('\n')

// Progress Logger
let progress
const task = message => {
  progress = animateProgress(message)
  process.stdout.write(message)

  return error => {
    if (error) {
      process.stderr.write(error)
    }
    clearTimeout(progress)
    return addCheckmark(() => newLine())
  }
}

module.exports = task
