import chalk from 'ansi-colors-browserify'
import cliui from 'cliui'
import { multiaddr } from '@multiformats/multiaddr'

import Debug from 'debug'
import { Address } from '@dreamcatcher-tech/interblock/src/w008-ipld'
const debug = Debug('dos:commands:adddPeer')

export const addMultiAddress = async ({ blockchain }, multiaddrString) => {
  if (globalThis.window) {
    multiaddrString = await globalThis.window.prompt()
  }
  const addr = multiaddr(multiaddrString)
  await blockchain.net.addMultiAddress(addr)
  return { out: `added multi address: ${addr.toString()}` }
}

const help = `
Lists info about the current machine, current user, and connected hypercomputer
`
