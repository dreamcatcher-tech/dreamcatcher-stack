import chalk from 'ansi-colors-browserify'
import cliui from 'cliui'
import { peerIdFromString } from '@libp2p/peer-id'

import Debug from 'debug'
import { Address } from '@dreamcatcher-tech/interblock/src/w008-ipld'
const debug = Debug('dos:commands:adddPeer')

export const mount = async ({ blockchain }, chainId, name) => {
  const result = await blockchain.mount(chainId, name)
  return { out: result }
}

const help = `
Lists info about the current machine, current user, and connected hypercomputer
`
