import * as collection from './src/collection.js'
import * as datum from './src/datum.js'
import * as net from './src/net.js'
import * as shell from './src/shell'
import * as hyper from './src/hyper'
import * as probe from './src/probe'
import * as unity from './src/unity'
import * as root from './src/unity'
import * as covenant from './src/covenant'
import * as ai from './src/ai.js'
import * as threads from './src/threads.js'
import * as goalie from './src/goalie.js'
import * as hal from './src/hal.js'
import * as bookMaker from './src/book-maker.js'
import * as stucks from './src/stucks.js'
import { Address } from '../w008-ipld/index.mjs'

export {
  collection,
  datum,
  hyper,
  probe,
  shell,
  unity,
  root,
  covenant,
  net,
  ai,
  threads,
  goalie,
  hal,
  bookMaker,
  stucks,
}

/**
 * Idea here is to provide a set of functions that can be used by any covenant to lock the current version of the system covenants that are in use.
 * A publisher might wish to reuse these classes to lock their own publications to a specific chain.
 * We can use techniques like 'pulselink + 1' to allow reference to the pulselink that we are contained within, whilst still using hashes.
 * importMap would need to override the explicit pulselink that was specified.
 */
const ADDRESS = Address.createCI('TODO create a chain for system covenants')
// const LATEST = PulseLink.generate() // TODO inject the latest pulselink
class System {
  constructor(name) {}
  getPulseLink() {
    // return the pulselink for the whole system chain, as recent as we know it
  }
  shell(version) {
    // allow to ask for a specific version ?
    return new System('shell')
  }
}
