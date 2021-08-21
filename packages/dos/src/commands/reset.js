import Enquirer from 'enquirer-browserify'
import Debug from 'debug'
const debug = Debug('dos:commands:reset')

export const reset = async ({ spinner, blockchain }) => {
  debug(`reset`)
  spinner.stop()
  const { reset } = await Enquirer.prompt({
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

const help = `
Dump all the local blockchain state, generate a new
genesis block, reset login status.
In dev mode will also reset the emulated aws.
`
