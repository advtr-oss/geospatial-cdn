'use strict'

/* global geonames, locales */

/**
 * The data for transformation, i.e what is removed from the original geonames tsv and converted to ours
 * */

/**
 * @param {Array<string>} headers
 * @param {function} map
 * */
function Schema (headers, map = clean) {
  this.headers = headers
  this.map = map
}

const countrySchema = new Schema(
  [
    'code.iso',
    'code.iso3',
    'code.iso_numeric',
    'code.fips',
    'name',
    'capital',
    'area',
    'population',
    'continent',
    'tld',
    'currency.code',
    'currency.name',
    'phone_prefix',
    'postal_code.format',
    'postal_code.regex',
    'languages',
    'id',
    'neighbours',
    'code.equiv_fips'
  ],
  (el) => {
    if (el.__line <= 51) return {}
    return clean(el)
  }
)

const citySchema = new Schema(
  [
    'id',
    'name',
    'ascii_name',
    'alternate_names',
    'lat',
    'lon',
    'type.class',
    'type.code',
    'country',
    'cc2',
    'region.a1',
    'region.a2',
    'region.a3',
    'region.a4',
    'meta.pop',
    'meta.elv',
    'meta.dem',
    'meta.tz',
    'lastUpdated'
  ], (el) => {
    // Would be better if we could remove this line crap
    const data = clean(el)
    delete data.__line

    geonames.add(el.id)

    return ({
      ...data,
      alternate_names: undefined
    })
  }
)

const isWikipedia = (name) => /wiki/gi.test(name)

const alternativeSchema = new Schema(
  [
    'id',
    'placeid',
    'iso',
    'name',
    'preferred',
    'short',
    'colloquial',
    'historic',
    'from',
    'to'
  ], (el) => {
    if (!el.placeid || !geonames.has(el.placeid) || !locales.has(el.iso) || isWikipedia(el.name)) return {}
    return {
      ...clean(el),
      __line: undefined
    }
  }
)

const languageSchema = new Schema(
  [
    'iso_639-3',
    'iso_639-2',
    'iso_639-1',
    'language'
  ], (el) => ({
    ...el,
    __line: undefined
  })
)

const adminSchema = new Schema(
  [
    'code',
    'name',
    'ascii_name',
    'id'
  ], (el) => {
    // Would be better if we could remove this line crap
    const data = clean(el)
    delete data.__line

    const components = el.code.split('.')
    const code = components.pop()

    geonames.add(el.id)

    // Messy but works
    return {
      ...data,
      ...components[1] && { parent: components[1] },
      country: components[0],
      code
    }
  }
)

module.exports = {
  citySchema,
  adminSchema,
  countrySchema,
  languageSchema,
  alternativeSchema
}

function clean (obj) {
  const clone = { ...obj }
  var propNames = Object.getOwnPropertyNames(clone)
  for (var i = 0; i < propNames.length; i++) {
    var propName = propNames[i]
    if (clone[propName] === null || clone[propName] === undefined || clone[propName] === '') {
      delete clone[propName]
    }

    // Here we can create internal objects for shared values, helpful condensing codes
    // or shared values
    //
    // Probably a better way but https://stackoverflow.com/a/26909522
    if (propName.includes('.')) {
      const value = createObject(propName, clone[propName])
      delete clone[propName]

      const key = propName.split('.').shift()
      // This is real messy!
      clone[key] = clone[key] ? { ...clone[key], ...clean(value[key]) } : { ...clean(value[key]) }
    }
  }
  return clone
}

function createObject (key, value) {
  var obj = {}
  var parts = key.split('.')
  if (parts.length === 1) {
    obj[parts[0]] = value
  } else if (parts.length > 1) {
    // concat all but the first part of the key
    var remainingParts = parts.slice(1, parts.length).join('.')
    obj[parts[0]] = createObject(remainingParts, value)
  }
  return obj
}
