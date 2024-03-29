import assert from 'assert-fast'
import { Address, Dmz, Pulse, HistoricalPulseLink, Transmissions } from '.'
import { IpldStruct } from './IpldStruct'
import Debug from 'debug'
import { Validators } from './Validators'
import { Network } from './Network'
const debug = Debug('interblock:classes:Provenance')
/**
## Provenance

Basically answers where did the current snapshot of the `Dmz` come from.

A `StateTreeNode` is used to provide an overlay tree to separate the covenant defined knowledge from the activity that the system operations generate while tending to the covenants intentions.

`lineageTree` is a tree now, not a chain, and this link points to the root of the tree.

`turnoversTree` lists all the `Pulse`s that changed the validator set or quorum threshold, to allow rapid validation without seeing every block in the chain.

The only Pulse that does not have a transmissions slice is the genesis Pulse.

```sh
type StateTreeNode struct {
    state &State
    binary &Binary
    children { String : &StateTreeNode }
}
type Lineage [Link]          # TODO use a derivative of the HAMT as array ?
type Turnovers [HistoricalPulseLink]   # TODO make into a tree
type Provenance struct {
    dmz &Dmz
    states &StateTreeNode
    lineages &Lineage     # Must allow merging of N parents

    validators &Validators
    turnovers &Turnovers
    address Address
    transmissions { String: Tx }
}
```
 */
export class Provenance extends IpldStruct {
  static classMap = {
    dmz: Dmz,
    lineages: HistoricalPulseLink,
    validators: Validators,
    address: Address,
    transmissions: Transmissions,
  }
  static createGenesis(dmz = Dmz.create(), validators = Validators.createCI()) {
    assert(dmz instanceof Dmz)
    const address = Address.createGenesis()
    const provenance = {
      dmz,
      states: 'TODO',
      // later, will allow foreign chains as prefixes to the provenance index
      lineages: [],

      validators,
      turnovers: 'TODO',
      address,
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
    const historyLink = HistoricalPulseLink.generate(pulse)
    assert(historyLink.cid.equals(pulse.cid))
    const lineages = [historyLink]
    return this.setMap({ lineages })
  }
  async crush(resolver) {
    // TODO find how to integrate with IpldStruct cached version
    if (!this.#cachedCrush) {
      this.#cachedCrush = await this.#crush(resolver)
    }
    return this.#cachedCrush
  }
  #cachedCrush
  async #crush(resolver) {
    const isCidLink = true
    if (this.address.isGenesis() || this.transmissions) {
      return super.crush(resolver, isCidLink)
    }
    // create the transmissions slice
    const { channels } = this.dmz.network
    const { txs } = channels
    assert(Array.isArray(txs))
    let next = this
    if (!txs.length) {
      // TODO define rules on block tighter
      // may require at least one tick forwards
      return super.crush(resolver, isCidLink)
    }
    let transmissions = Transmissions.create()
    for (const channelId of txs) {
      const { address, tx } = await channels.getChannel(channelId)
      transmissions = transmissions.addTx(address, tx)
    }

    next = next.setMap({ transmissions })
    const crushed = await next.crush(resolver)
    return crushed
  }
}
