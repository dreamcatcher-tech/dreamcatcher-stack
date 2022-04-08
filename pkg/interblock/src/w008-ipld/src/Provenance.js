import assert from 'assert-fast'
import { Address, Dmz, Pulse, PulseLink } from '.'
import { IpldStruct } from './IpldStruct'
import Debug from 'debug'
const debug = Debug('interblock:classes:Provenance')
/**
 type StateTreeNode struct {
    state &State
    binary &Binary
    children { String : &StateTreeNode }
}
type Lineage [Link]          # TODO use a derivative of the HAMT as array ?
type Turnovers [PulseLink]      # TODO make into a tree
type Provenance struct {
    stateTree &StateTreeNode
    lineageTree &Lineage     # Must allow merging of N parents
    turnovers &Turnovers
    address Address
    contents Dmz
}
 */
export class Provenance extends IpldStruct {
  static classMap = { address: Address, dmz: Dmz, lineages: PulseLink }
  static createGenesis(dmz = Dmz.create()) {
    // used to make genesis
    assert(dmz instanceof Dmz)
    const address = Address.createGenesis()
    const provenance = {
      states: 'TODO',
      // later, will allow foreign chains as prefixes to the provenance index
      lineages: [],
      turnovers: 'TODO',
      address,
      dmz,
    }
    return super.clone(provenance)
  }
  hasLineage(pulse) {
    assert(pulse instanceof Pulse)
    for (const pulseLink of this.lineages) {
      if (pulseLink.cid.equals(pulse.cid)) {
        return true
      }
    }
    return false
  }
  setLineage(pulse) {
    assert(pulse instanceof Pulse)
    const pulseLink = PulseLink.generate(pulse)
    const lineages = [pulseLink]
    assert(pulseLink.cid.equals(pulse.cid))
    return this.setMap({ lineages })
  }

  // isNextProvenance(child) {
  //   assert(child instanceof Provenance)
  //   const parentLineage = child.lineage.get(this.height + '')
  //   const isParent =
  //     parentLineage && parentLineage.deepEquals(this.reflectIntegrity())
  //   const isHigher = child.height > this.height
  //   return isParent && isHigher
  // }
  // static generateIntegrity(obj) {
  //   const checkKeys = ['dmzIntegrity', 'height', 'address', 'lineage']
  //   const check = {}
  //   for (const key of checkKeys) {
  //     assert(typeof obj[key] !== undefined, `missing integrity key: ${key}`)
  //     check[key] = obj[key]
  //   }
  //   check.dmzIntegrity = check.dmzIntegrity.hashString()
  //   check.address = check.address.hashString()
  //   if (obj.lineage instanceof Base) {
  //     check.lineage = {}
  //     for (const [key, value] of obj.lineage.entries()) {
  //       check.lineage[key] = value
  //     }
  //   } else {
  //     // in provenanceProducer, we cannot make a map, so used a plain object
  //     check.lineage = { ...obj.lineage }
  //   }
  //   for (const key of Object.keys(check.lineage)) {
  //     check.lineage[key] = check.lineage[key].hashString()
  //   }
  //   assert(!check.height || Object.keys(check.lineage).length)
  //   const integrity = Integrity.create(check)
  //   return integrity
  // }
}
