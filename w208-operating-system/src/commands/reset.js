const debug = require('debug')('dos:commands:reset')
const { prompt } = require('enquirer')

module.exports = async ({ spinner, blockchain }) => {
  debug(`reset`)
  spinner.stop()
  const { reset } = await prompt({
    type: 'confirm',
    name: 'reset',
    message: 'Resetting will delete all local blockchains',
  })
  let msg
  if (reset) {
    msg = `All local blockchains deleted`
  } else {
    msg = `Cancelled reset`
  }
  return { out: msg }
}

module.exports.help = `
Dump all the local blockchain state, generate a new
genesis block, reset login status.
In dev mode will also reset the emulated aws.
`
