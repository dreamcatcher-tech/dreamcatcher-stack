import assert from 'assert-fast'
import { Address, Pulse } from '.'
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

export class Interpulse extends IpldStruct {
  static extract(pulse, target) {
    assert(pulse instanceof Pulse)
    assert(!pulse.isModified())
    assert(target instanceof Address)
    console.dir(pulse.provenance.transmissions, { depth: Infinity })
    let { provenance, signatures } = pulse
    const { validators, turnovers, address, transmissions } = provenance
    const chainId = target.getChainId()
    assert(transmissions[chainId])
    const tx = transmissions[chainId]

    return super.clone({
      signatures,
      validators,
      turnovers,
      source: address,
      target,
      tx,
    })
  }
  crush() {
    return this // always crushed
  }
  setMap() {
    throw new Error('cannot modify an Interpulse')
  }
  set() {
    this.setMap()
  }
  delete() {
    this.setMap()
  }
  getTargetAddress() {
    return this.tx.address
  }
}
