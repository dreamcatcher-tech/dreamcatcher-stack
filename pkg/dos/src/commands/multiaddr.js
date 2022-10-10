import { multiaddr as fromString } from '@multiformats/multiaddr'

import Debug from 'debug'
const debug = Debug('dos:commands:multiaddr')

export const multiaddr = async ({ blockchain }, multiaddrString) => {
  const addr = fromString(multiaddrString)
  await blockchain.newhot.addMultiAddress(addr)
  return { out: `added multi address: ${addr.toString()}` }
}
