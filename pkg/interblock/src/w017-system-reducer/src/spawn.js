import assert from 'assert-fast'
import { Channel, Network, Dmz, RxRequest, Provenance } from '../../w008-ipld'
import { autoAlias } from './utils'
import { replyPromise } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:dmz:spawn')

const spawn = (alias, spawnOpts = {}) => {
  const action = {
    type: '@@SPAWN',
    payload: { alias, spawnOpts },
  }
  if (!alias) {
    delete action.payload.alias
  }
  return action
}

const spawnReducer = async (provenance, rxRequest) => {
  assert(provenance instanceof Provenance)
  assert(rxRequest instanceof RxRequest)
  const [nextProvenance, requestId] = await spawnRequester(
    provenance,
    rxRequest
  )
  replyPromise() // allows spawnReducer to be reused by deploy reducer
  const originRequestId = rxRequest.requestId
  const slice = { type: '@@GENESIS', originRequestId }
  const meta = metaProducer.withSlice(dmz.meta, requestId, slice)
  return nextDmz.update({ meta })
}
const spawnRequester = async (provenance, rxRequest) => {
  assert(provenance instanceof Provenance)
  assert(rxRequest instanceof RxRequest)
  assert.strictEqual(rxRequest.type, '@@SPAWN')
  let { alias, spawnOpts } = rxRequest.payload
  assert(!alias || typeof alias === 'string')
  assert.strictEqual(typeof spawnOpts, 'object')

  // TODO reject if spawn requested while deploy is unresolved
  // may reject any actions other than cancel deploy while deploying ?
  assert.strictEqual(spawnOpts.validators, undefined, `cannot spec validators`)
  assert.strictEqual(spawnOpts.timestamp, undefined, `cannot spec timestamp`)
  // TODO check spawnOpts match a schema

  alias = alias || autoAlias(provenance.dmz.network)
  debug(`spawn alias: ${alias}`)
  assert(!alias.includes('/'), `No / character allowed in "${alias}"`)
  if (alias === '.' || alias === '..' || alias == '.@@io') {
    throw new Error(`Alias uses reserved name: ${alias}`)
  }
  provenance = await provenance.addChild(alias, spawnOpts)
  const channel = await provenance.dmz.network.getChannel(alias)
  const requestId = channel.getGenesisRequestId()
  return [provenance, requestId]
}

export { spawn, spawnReducer, spawnRequester }
