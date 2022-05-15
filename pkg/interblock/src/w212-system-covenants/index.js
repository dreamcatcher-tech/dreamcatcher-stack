import * as collection from './src/collection'
import * as datum from './src/datum'
import * as dpkg from './src/dpkg'
import * as shell from './src/shell'
import * as hyper from './src/hyper'
import * as probe from './src/probe'
import * as unity from './src/unity'
import * as app from './src/unity'
import { Address, PulseLink } from '../w008-ipld'

export { collection, datum, dpkg, hyper, probe, shell, unity, app }

/**
 * Idea here is to provide a set of functions that can be used by any covenant to lock the current version of the system covenants that are in use.  
 * A publisher might wish to reuse these classes to lock their own publications to a specific chain.
 * We can use techniques like 'pulselink + 1' to allow reference to the pulselink that we are contained within, whilst still using hashes.
 * importMap would need to override the explicit pulselink that was specified.
 */
const ADDRESS = Address.createCI('TODO create a chain for system covenants')
// const LATEST = PulseLink.generate() // TODO inject the latest pulselink
class System {
  constructor(name)
  getPulseLink(){
    // return the pulselink for the whole system chain, as recent as we know it
  }
  shell(version){
    // allow to ask for a specific version ?
    return new System('shell')
  }
}