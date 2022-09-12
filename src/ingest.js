/* global geonames, locales */

const fs = require('fs')
const path = require('path')

const etl = require('etl')
const YAML = require('yaml')
const minimist = require('minimist')

const task = require('./helpers/task')
const Config = require('./config')

const { readFile, mkdir } = require('./helpers/fs')

const { citySchema, adminSchema, countrySchema, languageSchema, alternativeSchema } = require('./helpers/geoname-schemas')

const BASE_NAME_LANGUAGE = 'en'

const usage = () => {
  return [
    'parse.js',
    '',
    '  $ node parse.js (options) [dest]',
    '',
    'Options:',
    '  --output\tDirectory to save the new JSON files (defaults to [dest])',
    '  --languages\tLanguages to strip the data from and split them up',
    ''
  ].join('\n')
}

process.on('exit', code => {
  if (code !== 0) console.log('\n', usage())
  process.exit(code)
})

/**
 * Parse any data with an object that has `.parse` method
 * */
const parse = (type) => (data) => type.parse(data)

/**
 * @return {Config}
 * */
const loadConfig = () =>
  readFile(path.join(process.cwd(), './.config.yml'))
    .then(parse(YAML))
    .then((config) => new Config(config))

/**
 * @typedef {Object} StreamContext
 * @property {string|URL|Buffer} download
 * @property {string|URL|Buffer} output
 */

/*
 * @return {StreamContext}
 */
const createStreamContext = (ctx, filename) => ({
  download: path.join(ctx.cache, filename),
  output: path.join(ctx.output, `${path.basename(filename, path.extname(filename))}.json`)
})

/**
 * @param {StreamContext} ctx
 * @param {Schema} schema
 * */
const stream = (ctx, schema) =>
  fs.createReadStream(ctx.download)
    .pipe(etl.csv({ headers: schema.headers, separator: '\t', skipComments: true }))
    .pipe(etl.map(schema.map))
    .promise()

/**
 * @param {StreamContext} ctx
 * @param {Schema} schema
 * @param {number} collect
 * */
const steamWithCollect = (ctx, schema, collect = 1000) =>
  fs.createReadStream(ctx.download)
    .pipe(etl.csv({ headers: schema.headers, separator: '\t', skipComments: true }))
    .pipe(etl.map(schema.map))
    .pipe(etl.collect(collect))
    .promise()

const streamWithAddedStep = (ctx, schema, predicate) =>
  fs.createReadStream(ctx.download)
    .pipe(etl.csv({ headers: schema.headers, separator: '\t', skipComments: true }))
    .pipe(etl.map(schema.map))
    .pipe(etl.map(predicate))
    .promise()

// This is so we limit the alternative names
// may make this global, so we can access it anywhere
// then Schema.map can do the work
global.geonames = new Set([])
global.locales = new Set([])

/************************************************************
 *                                                          *
 *                                                          *
 *                 GENERATE DATA FUNCTIONS                  *
 *                                                          *
 ************************************************************/

/************************************************************
 *                                                          *
 *                                                          *
 *                    County Functions                      *
 *                                                          *
 *                                                          *
 ************************************************************/

// These could go into there own file tho tbf

const streamCountries = (ctx) =>
  stream(ctx, countrySchema)

const loadCountryJSON = (ctx) =>
  readFile(ctx.download)
    .then(parse(JSON))

const handleCountries = async (ctx, config) => {
  let [geoname, mledoze] = await Promise.all(config.sources.countries.map((source) =>
    (path.extname(source.file) === '.json' ? loadCountryJSON : streamCountries)(createStreamContext(ctx, source.file)))
  )

  const mledozeCountries = new Map([])
  mledoze.forEach((el) => {
    mledozeCountries.set(el.cca2, el)
  })

  // Remove any unneeded countries, as geonames holds older countries
  geoname = geoname
    .filter((el) => Object.keys(el).length > 0)
    .filter((el) => mledozeCountries.get(el.code.iso))
    .map((country) => {
      const mledozeCountry = mledozeCountries.get(country.code.iso)
      geonames.add(country.id)

      return {
        placeid: country.id,
        name: country.name,
        location: {
          lat: mledozeCountry.latlng[0],
          lng: mledozeCountry.latlng[1]
        },
        continent: country.continent,
        codes: {
          ...country.code
        },
        geoscheme: {
          region: mledozeCountry.region,
          subregion: mledozeCountry.subregion
        }
      }
    })

  return fs.promises.writeFile(path.join(ctx.output, 'countries.json'), JSON.stringify(geoname, '', 0))
}

/************************************************************
 *                                                          *
 *                                                          *
 *                    Region Functions                      *
 *                                                          *
 *                                                          *
 ************************************************************/

const streamRegion = (ctx, collection) =>
  steamWithCollect(ctx, adminSchema, collection)

const handleRegions = async (ctx, config) => {
  const [admin2, admin1] = await Promise.all(
    config.sources.admin.map((source) => streamRegion(createStreamContext(ctx, source.file), source.file === 'admin2Codes.txt' ? 5000 : 1000))
  )

  // Due to sizes, however, could work via region, but would require a sorting
  // of the array which would take longer, speed now for PoC, changes later
  await mkdir(path.join(ctx.output, './region/admin1'))
  await mkdir(path.join(ctx.output, './region/admin2'))

  for (let i = 0; i < admin1.length; i++) {
    // admin1[i].forEach((el) => geonames.add(el.id))
    await fs.promises.writeFile(path.join(ctx.output, './region/admin1', `${i}.json`), JSON.stringify(admin1[i], '', 0))
  }

  for (let i = 0; i < admin2.length; i++) {
    // admin2[i].forEach((el) => geonames.add(el.id))
    await fs.promises.writeFile(path.join(ctx.output, './region/admin2', `${i}.json`), JSON.stringify(admin2[i], '', 0))
  }
}

/************************************************************
 *                                                          *
 *                                                          *
 *                    Cities Functions                      *
 *                                                          *
 *                                                          *
 ************************************************************/

const streamCities = (ctx) =>
  steamWithCollect(ctx, citySchema, 10000)

const handleCities = async (ctx, config) => {
  const cities = await streamCities(createStreamContext(ctx, config.sources.cities.pop().file))

  // Due to sizes, however, could work via region, but would require a sorting
  // of the array which would take longer, speed now for PoC, changes later
  await mkdir(path.join(ctx.output, './cities'))

  for (let i = 0; i < cities.length; i++) {
    // cities[i].forEach((el) => geonames.add(el.id))
    await fs.promises.writeFile(path.join(ctx.output, './cities', `${i}.json`), JSON.stringify(cities[i], '', 0))
  }
}

/************************************************************
 *                                                          *
 *                                                          *
 *                      80's Functions                      *
 *                                                          *
 *                                                          *
 ************************************************************/

const streamLanguages = (ctx) =>
  stream(ctx, languageSchema)

const streamAlternative = (ctx, predicate) =>
  streamWithAddedStep(ctx, alternativeSchema, predicate)

const handleThe80s = async (ctx, config) => {
  const rawLanguages = await streamLanguages(createStreamContext(ctx, config.sources.languages.pop().file))

  // This guarantees the languages passed here are valid
  locales.add('wkdt'); locales.add('link'); locales.add('abbr')
  const languages = rawLanguages.filter(el => config.localisation.includes(el['iso_639-1']))
  languages.map((el) => el['iso_639-1']).forEach((el) => locales.add(el))

  await mkdir(path.join(ctx.output, './localisation'))
  await mkdir(path.join(ctx.output, './alternatives'))

  // Hold this file so the ingest can use it to figure out the routing
  await fs.promises.writeFile(path.join(ctx.output, './localisation', 'locale.json'), JSON.stringify(languages, '', 2))

  const alts = {}
  locales.forEach((el) => {
    alts[el] = []
  })

  await streamAlternative(createStreamContext(ctx, config.sources.alternatives.pop().file), (el) => {
    el.iso && alts[el.iso].push(el)
    return {}
  })

  const createPath = (key) => {
    switch (key) {
      case 'wkdt': case 'link': case 'abbr':
        return path.join(ctx.output, './alternatives', `${key}.json`)
      default: return path.join(ctx.output, './localisation', `${key}.json`)
    }
  }

  const keys = Object.keys(alts)
  for (let i = 0; i < keys.length; i++) {
    await fs.promises.writeFile(createPath(keys[i]), JSON.stringify(alts[keys[i]], '', 0))
  }
}

/************************************************************
 *                                                          *
 *                                                          *
 *                            Main                          *
 *                                                          *
 *                                                          *
 ************************************************************/

async function main (args = process.argv.slice(2)) {
  console.log('@advtr/place-cdn.ingest starting')

  const cli = minimist(args)

  if (!cli.output) {
    throw new Error('Invalid cli arguments')
  }

  // Initialise the config and boilerplate code
  const loadingConfigTask = task('=> loading config')
  const config = await loadConfig()
  loadingConfigTask()

  // Can use this object in methods
  const ctx = {
    cache: path.resolve(config.tmp),
    output: path.join(path.resolve(cli.output), './data')
  }

  /**
   * Since most geonames are in the english version, I think we should make
   * sure we hold onto the preferred values for later use if we decide
   * to manipulate the documents names based on preferred status
   *
   * @NB: MAY BE REMOVED
   * */
  if (!config.localisation.includes(BASE_NAME_LANGUAGE)) {
    config.localisation.push(BASE_NAME_LANGUAGE)
  }

  // Check if the cache exists, if not we can exit now
  await fs.promises.access(ctx.cache, fs.constants.R_OK)

  // Create the output dir
  //
  // Could delete maybe first, or do that in serve ??
  await mkdir(ctx.output)

  const handleCountriesTask = task('=> Ingesting country data')
  await handleCountries(ctx, config)
  handleCountriesTask()
  console.debug(`${geonames.size} added`)

  const handleRegionsTask = task('=> Ingesting region data')
  await handleRegions(ctx, config)
  handleRegionsTask()
  console.debug(`${geonames.size} added`)

  const handleCitiesTask = task('=> Ingesting city data')
  await handleCities(ctx, config)
  handleCitiesTask()
  console.debug(`${geonames.size} added`)

  const handleThe80sTask = task('=> Ingesting alternative data')
  await handleThe80s(ctx, config)
  handleThe80sTask()
}

/**
 * Runner
 * */
main().then(() => {
  console.log('@advtr/place-cdn.ingest finished')
}).catch((err) => {
  console.error(err)
  process.exit(typeof err.code === 'number' ? err.code : 1)
})
