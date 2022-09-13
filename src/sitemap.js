const fs = require('fs')
const path = require('path')
const util = require('util')

const ejs = require('ejs')
const glob = require('glob')
const minimist = require('minimist')
const merge = require('lodash.merge')

const globAsync = util.promisify(glob)

const task = require('./helpers/task')

const usage = () => {
  return [
    'sitemap.js',
    '',
    '  $ node sitemap.js (options) [dest]',
    '',
    'Options:',
    '  --base\tDirectory to save the new html files (defaults to [dest])',
    '  --glob\tThe glob to lookup',
    ''
  ].join('\n')
}

process.on('exit', code => {
  if (code !== 0) console.log('\n', usage())
  process.exit(code)
})

function File (name) {
  this.name = name
  this.__file = true
}

const guard = (fn) => {
  try {
    return fn()
  } catch (err) { return false }
}

const main = async (args = process.argv.slice(2)) => {
  console.log('@advtr/place-cdn.sitemap starting')

  const cli = minimist(args)

  const dest = cli._.shift()

  if (!dest) {
    throw new Error('Invalid CLI arguments')
  }

  const ctx = {
    base: guard(() => path.resolve(cli.base)) || path.resolve(dest),
    dest: path.resolve(dest),
    glob: glob.hasMagic(cli.glob || '') ? cli.glob : '**/*.json'
  }

  console.log('Creating sitemap for ' + ctx.base)
  const loadTemplate = task('Load template')
  const pkg = require('../package.json')
  const tmplFile = path.join(__dirname, './templates/sitemap.html.ejs')
  const template = (await fs.promises.readFile(tmplFile)).toString()
  loadTemplate()

  const createHierarchy = (files) => {
    const hierarchy = (file) => {
      if (!file.includes('/')) return {[file]: new File(file)}

      const parts = file.split('/')
      const key = parts.shift()
      return { [key]: { name: key, contents: hierarchy(parts.join('/')), __dir: true } }
    }

    let state = {}
    for (const file of files) {
      state = merge(state, hierarchy(file))
    }

    return state
  }

  const globFiles = task('Glob files')
  const route = path.relative(process.cwd(), ctx.dest).replace('serve', '')
  const results = await globAsync(ctx.glob, { cwd: ctx.base })
  globFiles()

  const renderTemplate = task('Render template')
  const html = ejs.render(template, { version: pkg.version, dest: route, hierarchy: createHierarchy(results)  }, { filename: tmplFile, async: false })
  await fs.promises.writeFile(path.join(ctx.dest, 'index.html'), html)
  await fs.promises.copyFile(path.join(__dirname, './templates/sitemap.css'), path.join(ctx.dest, 'index.css'))
  renderTemplate()
}

/**
 * Runner
 * */
main().then(() => {
  console.log('@advtr/place-cdn.sitemap finished')
}).catch((err) => {
  console.error(err)
  process.exit(typeof err.code === 'number' ? err.code : 1)
})
