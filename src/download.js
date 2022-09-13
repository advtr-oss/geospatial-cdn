/**
 * Terribley messy here
 * */

const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

const YAML = require('yaml')
const git = require('@npmcli/git')
const request = require('request')
const unzipper = require('unzipper')

const requestAsync = promisify(request)

const task = require('./helpers/task')
const Config = require('./config')

const { readFile, mkdir } = require('./helpers/fs')

const parse = (type) => (data) => type.parse(data)

/**
 * @return {Config}
 * */
const loadConfig = () =>
  readFile(path.join(process.cwd(), './.config.yml'))
    .then(parse(YAML))
    .then((config) => new Config(config))

const handleZip = (url) => unzipper.Open.url(request, url)

function Process (url, type, file, repo) {
  this.url = url
  this.type = type
  this.file = file
  this.repo = repo
}

process.on('log', console.log)

async function main () {
  console.log('@advtr/place-cdn.download starting')

  // Initialise the config and boilerplate code
  const loadingConfigTask = task('=> loading config')
  const config = await loadConfig()
  loadingConfigTask()

  await mkdir(config.tmp)

  const jobs = []
  Object.keys(config.sources).forEach((key) => {
    const links = config.sources[key]
    links.forEach((link) => {
      jobs.push(new Process(link.url, link.type || 'zip', link.file, link.uri))
    })
  })

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]

    let jobTask
    switch (job.type) {
      case 'file': {
        jobTask = task(`=>  fetching ${job.url}`)

        const res = await requestAsync(job.url)
        await fs.promises.writeFile(path.join(config.tmp, job.file), res.body, 'utf-8')
        break
      }
      case 'zip': {
        jobTask = task(`=> downloading ${job.url}`)

        /**
         * This is all messy but works
         * */
        const dir = await handleZip(job.url)
        const file = dir.files.find(d => d.path === path.basename(job.file))

        const content = await file.buffer()
        await mkdir(path.join(config.tmp, path.dirname(job.file)))
        await fs.promises.writeFile(path.join(config.tmp, job.file), content, 'utf-8')

        break
      }
      case 'git': {
        await git.clone(job.url, 'HEAD', path.join(config.tmp, job.repo))
        jobTask = task(`=> cloning ${job.url}`)
        break
      }
    }

    jobTask && jobTask()
  }

  return jobs
}

/**
 * Runner
 * */
main().then(() => {
  console.log('@advtr/place-cdn.download finished')
}).catch((err) => {
  console.error(err)
  process.exit(typeof err.code === 'number' ? err.code : 1)
})
