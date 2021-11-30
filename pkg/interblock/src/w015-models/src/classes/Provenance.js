import assert from 'assert-fast'
import { Dmz, Integrity, Address } from '.'
import { provenanceSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'

export class Provenance extends mixin(provenanceSchema) {
  static create(dmz = Dmz.create(), forkedLineage = {}) {
    assert(dmz instanceof Dmz)
    assert(dmz.hashString(), 'Dmz must be ready for hashing')
    assert.strictEqual(typeof forkedLineage, 'object')
    // TODO handel raw Uint8Array
    const dmzIntegrity = Integrity.create(dmz.hashString())
    const provenance = {
      dmzIntegrity,
      height: 0,
      address: Address.create('GENESIS'),
      lineage: forkedLineage,
    }
    const integrity = Integrity.create(provenance)
    const signatures = []

    return super.create({ ...provenance, integrity, signatures })
  }
}
