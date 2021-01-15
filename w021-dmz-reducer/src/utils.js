const debug = require('debug')('interblock:dmz:utils')
const pad = require('pad/dist/pad.umd')
const autoAlias = (network, autoPrefix = 'file_') => {
  // TODO get highest current auto, and always return higher
  let highest = 0
  network.getAliases().forEach((alias) => {
    if (alias.startsWith(autoPrefix)) {
      try {
        const count = parseInt(alias.substring(autoPrefix.length))
        highest = count > highest ? count : highest
      } catch (e) {
        debug(`autoAlias error: `, e)
        throw e
      }
    }
  })
  return autoPrefix + pad(5, highest + 1, '0')
}
module.exports = { autoAlias }
