const debug = require('debug')('dos-shell:commands:namegen')
const dockerNames = require('docker-names')

module.exports = async ({ spinner, blockchain }, count = 1) => {
  // TODO handle nested and remote paths
  debug(`count: %O`, count)
  let out = ``
  while (count > 0) {
    out += dockerNames.getRandomName()
    count--
    if (count > 0) {
      out += `\n`
    }
  }

  return {
    out
  }
}

module.exports.help = `
Generate a random name, which can be used as an identity for anything.
`
