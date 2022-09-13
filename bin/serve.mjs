#!/usr/bin/env zx

const debug = process.argv.includes('--debug')
  || !!process.env.DEBUG

import path from 'path'

import yaml from 'yaml';
const { parse } = yaml;

/**
 * Load the config, only here for debugging, so can remove the shared temp dir
 *
 * @return {Object}
 * */
const loadConfig = () =>
  fs.readFile(path.join(process.cwd(), './.config.yml'))
    .then((buffer) => buffer.toString())
    .then(parse)

/**
 * Load the package.json
 *
 * @return {Object}
 * */
const loadPackage = () =>
  fs.readFile(path.join(process.cwd(), './package.json'))
    .then((buffer) => buffer.toString())
    .then(JSON.parse)

/**
 * Raw config yaml
 * */
const config = await loadConfig()

/**
 * Load package.json
 *
 * Wish this was includes in
 * */
const pkg = await loadPackage()

/**
 * Our temp dir
 * */
const kTEMP_DIR = config.meta.tmp || `${os.tmpdir()}/co.uk.advtr.cdn.place/`

/**
 * Start the process
 * */

try {
  await $`rm -Rf ./serve`
  await $`rm -Rf ${kTEMP_DIR}`
} catch (e) {
  console.log(e.stderr)
}

// Download
try {
  await $`node ./src/download.js`
} catch (e) {
  console.log(e.stderr)

  // Delete this on a crash, no need for it
  if (!debug) await $`rm -rf ${kTEMP_DIR}`

  process.exit(e.exitCode || 1)
}

// Process
await $`node ./src/ingest.js --output ./serve`

// Copy the static files
const repo = config.sources.countries[config.sources.countries.findIndex((el) => el.type === 'git')]
const repoPath = path.join(kTEMP_DIR, repo.uri)

await $`mkdir -p ./serve/static/geojson/`
await $`node ./src/mapshaper ${path.join(repoPath, './data/*.geo.json')} -clean -proj wgs84 -o format=geojson ./serve/static/geojson/`

await $`mkdir -p ./serve/static/flags/`
await $`find ${path.join(kTEMP_DIR, repo.uri)} -name '*.svg' -exec cp '{}' './serve/static/flags' ';'`

// Add sitemaps
await $`find ./serve -type d -print -exec node ./src/sitemap.js --glob '**/*.+(json|svg)' '{}' ';'`

/**
 * Create the static page
 *
 * Basically identical to the rest of the acknowledgements pages of advtr
 * */
await $`npx ejs ./src/templates/index.html.ejs version=${pkg.version} -f ./src/templates/acknowledgements.json -o ./serve/index.html`

// Make it spicy
await $`cp ./index.css ./serve/index.css`

await $`cp ./src/templates/404.html ./serve/404.html`

if (!debug) {
  $`rm -Rf ${kTEMP_DIR}`
} else {
  console.log('All files are saved in', kTEMP_DIR, 'for viewing pleasure...')
}
