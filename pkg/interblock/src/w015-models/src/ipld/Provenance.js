import assert from 'assert-fast'
import { Address, Dmz } from '.'
import { IpldStruct } from './IpldStruct'
import Debug from 'debug'
const debug = Debug('interblock:classes:Provenance')

export class Provenance extends IpldStruct {
  static createGenesis(dmz = Dmz.create()) {
    // used to make genesis
    assert(dmz instanceof Dmz)
    const genesis = Address.createGenesis()
    const provenance = {
      stateTree: 'TODO',
      // later, will allow foreign chains as prefixes to the provenance index
      lineageTree: 'TODO',
      turnoversTree: 'TODO',
      genesis,
      dmz,
    }
    return super.clone(provenance)
  }
  isNextProvenance(child) {
    assert(child instanceof Provenance)
    const parentLineage = child.lineage.get(this.height + '')
    const isParent =
      parentLineage && parentLineage.deepEquals(this.reflectIntegrity())
    const isHigher = child.height > this.height
    return isParent && isHigher
  }
  static generateIntegrity(obj) {
    const checkKeys = ['dmzIntegrity', 'height', 'address', 'lineage']
    const check = {}
    for (const key of checkKeys) {
      assert(typeof obj[key] !== undefined, `missing integrity key: ${key}`)
      check[key] = obj[key]
    }
    check.dmzIntegrity = check.dmzIntegrity.hashString()
    check.address = check.address.hashString()
    if (obj.lineage instanceof Base) {
      check.lineage = {}
      for (const [key, value] of obj.lineage.entries()) {
        check.lineage[key] = value
      }
    } else {
      // in provenanceProducer, we cannot make a map, so used a plain object
      check.lineage = { ...obj.lineage }
    }
    for (const key of Object.keys(check.lineage)) {
      check.lineage[key] = check.lineage[key].hashString()
    }
    assert(!check.height || Object.keys(check.lineage).length)
    const integrity = Integrity.create(check)
    return integrity
  }
}
