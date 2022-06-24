import assert from 'assert-fast'
import { Address, Dmz, Pulse, PulseLink, Transmissions } from '.'
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
type Turnovers [PulseLink]   # TODO make into a tree
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
    lineages: PulseLink,
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
    const pulseLink = PulseLink.generate(pulse)
    const lineages = [pulseLink]
    assert(pulseLink.cid.equals(pulse.cid))
    return this.setMap({ lineages })
  }
  async crush(resolver) {
    if (this.address.isGenesis() || this.transmissions) {
      return super.crush(resolver)
    }
    // create the transmissions slice
    const { channels } = this.dmz.network
    assert(Array.isArray(channels.txs))
    const txs = channels.txs.filter((i) => i !== Network.FIXED_IDS.IO)
    let next = this
    if (!txs.length) {
      // TODO define rules on block tighter
      // may require at least one tick forwards
      return super.crush(resolver)
    }
    let transmissions = Transmissions.create()
    for (const channelId of txs) {
      const { address, tx } = await channels.getChannel(channelId)
      transmissions = transmissions.addTx(address, tx)
    }
    next = this.setMap({ transmissions })
    return await next.crush(resolver)
  }

  // isNextProvenance(child) {
  //   assert(child instanceof Provenance)
  //   const parentLineage = child.lineage.get(this.height + '')
  //   const isParent =
  //     parentLineage && parentLineage.deepEquals(this.reflectIntegrity())
  //   const isHigher = child.height > this.height
  //   return isParent && isHigher
  // }
  /**
   * Make a set of actions that directly transform the DMZ.
   * When these actions are received, the engine triggers modification to DMZ.
   * Anything that involves continuation is done using responder functions.
   *
   * Or attach dmz to actions, then modify it and re-attach to the action.
   * Much easier to deal with in this way, but confusing for async code.
   * Split async and sync dmz actions into different reducers.
   * Sync follows the redux model.
   * Async follows the responder model.
   *
   * Unless we did useState as having special meaning if came from system ?
   * Make a generate useSoftpulse() to get the latest pulse
   * Then do modifications on it however we please
   * useState is just a scoped version of this
   *
   * attach dmz to payload of all actions being passed in to the asynctrail.
   * return the dmz attached to the reply payload if it was modified.
   *
   * useSoftpulse() to hook into some extra params supplied to wrapReduce.
   * provides a set() function that mutates the values passed in.
   * Caller retrieves these values out at the end.
   * BUT do we need to store previous versions of this value ?
   * ? Can a different value be provided and the functional calls be repeated ?
   * SO modifications to Pulse need to occur via actions,
   * rather than performing the modification twice.
   *
   * Make a different responder for making provenance changes.
   * Communicate with it using actions.
   * It takes in actions that are not pojos.
   * It responds using pojos.
   *
   * If we were careful, we could do all sync work before async,
   * and so do modifications to pulse in the same responder.
   * useSofpulse would be synchronous.
   * An extra arg passed to wrapReducer would be mutated by set()
   *
   * BUT we need to await the async provenance operations, but do not want
   * to start a trail.
   *
   * So perform some actions using redux, with no trails
   * These local operations - how do they respond ?
   * None of the actions are hooked, so it will just await as normal
   *
   * Nest wrapReducer ?
   * useMutable() to mutate the third arg to wrapReducer.
   * use the scope of the local responder to modify the live Provenance.
   *    Ensure no remote actions undertaken by the reducer.
   *
   * Do a special tx, so reply is treated as normal, if tx is special, then
   * in this unique case, reassign the pulse variable.
   * If the reduction has this special signature, kill the trail and reassign
   * the pulse variable.
   * Can switch out all these options in a single reducer.
   *
   * Extend reduction to include a 'syncState' variable.
   * Injected at the start, and used in the useSyncState calls.
   * any use of this variable prohibits any txs, or any settles.
   *
   */
}
