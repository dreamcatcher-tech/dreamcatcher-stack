import assert from 'assert-fast'
import { Address, Pulse, PulseLink } from '.'
import { IpldStruct } from './IpldStruct'

/**
 ## InterPulse

Structurally this is a Pulse, however for use within the model system, it is a Pulse that is not fully inflated. The Interpulse class is strictly a subset of the data contained in the Pulse class.
Note that the CID of an Interpulse is exactly the same as the Pulse that created it.

```sh
type InterProvenance struct {
    validators optional &Validators
    turnovers optional &Turnovers
    address Address
    transmissions { String: Tx }        # string addresses mapped to Tx's
}
type InterPulse struct {
    provenance &InterProvenance
    signatures Signatures
}
```

 */

export class Interpulse {
  #pulse
  static extract(pulse, target) {
    assert(pulse instanceof Pulse)
    assert(!pulse.isModified())
    assert(target instanceof Address)
    let { provenance, signatures } = pulse
    const { validators, turnovers, address, transmissions } = provenance
    const chainId = target.getChainId()
    assert(transmissions[chainId])
    const tx = transmissions[chainId]
    const instance = new this()
    Object.assign(instance, {
      signatures,
      validators,
      turnovers,
      source: address,
      target,
      tx,
    })
    instance.#pulse = pulse
    return instance
  }
  get cid() {
    return this.#pulse.cid
  }
  crush() {
    throw new Error(`InterPulse cannot be crushed`)
  }
  setMap() {
    throw new Error('cannot modify an Interpulse')
  }
  set() {
    throw new Error('cannot modify an Interpulse')
  }
  delete() {
    throw new Error('cannot modify an Interpulse')
  }
  getTargetAddress() {
    return this.tx.address
  }
  async uncrush(address) {
    // custom function that pieces together the Interpulse from the Pulse
    // resolves only the paths that it cares about
  }
  getPulseLink() {
    return PulseLink.generate(this.#pulse)
  }
}
