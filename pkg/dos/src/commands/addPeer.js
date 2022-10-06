import chalk from 'ansi-colors-browserify'
import cliui from 'cliui'
import { peerIdFromString } from '@libp2p/peer-id'

import Debug from 'debug'
import { Address } from '@dreamcatcher-tech/interblock/src/w008-ipld'
const debug = Debug('dos:commands:adddPeer')

export const addPeer = async ({ blockchain }, addressString, peerIdString) => {
  addressString = window.prompt()
  peerIdString = window.prompt()
  const address = Address.fromChainId(addressString)
  const peerId = peerIdFromString(peerIdString)
  blockchain.net.addAddressPeer(address, peerId)
  return { out: `added peer: ${peerId} for address: ${address}` }
}

const help = `
Lists info about the current machine, current user, and connected hypercomputer
`
