const os = require('os')
const path = require('path')

const meta = Symbol('plcdn-meta')

function Config (yml) {
  this[meta] = yml.meta

  this.sources = {}
  Object.keys(yml.sources).forEach((key) => {
    this.sources[key] = yml.sources[key].map((el) => {
      return {
        ...el,
        file: el.type === 'git' ? path.join(el.uri, el.file) : el.file || el.uri,
        url: this[meta][el.src || 'src'].replace('{uri}', el.uri).replace('{branch}', el.branch)
      }
    })
  })

  this.tmp = yml.meta.tmp || `${os.tmpdir()}/co.uk.advtr.cdn.place/`
  this.localisation = yml.localisation || []
}


module.exports = Config
