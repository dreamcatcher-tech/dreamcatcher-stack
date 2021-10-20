import assert from 'assert-fast'
import {
  blockModel,
  actionModel,
  channelModel,
  interblockModel,
  networkModel,
  dmzModel,
  rxRequestModel,
  covenantIdModel,
} from '../../w015-models'
import { channelProducer } from '../../w016-producers'
import { autoAlias } from './utils'
import { replyPromise } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:dmz:spawn')

const spawn = (alias, spawnOpts = {}, actions = []) => {
  const action = {
    type: '@@SPAWN',
    payload: { alias, spawnOpts, actions },
  }
  if (!alias) {
    delete action.payload.alias
  }
  return action
}

const spawnReducer = async (dmz, originAction) => {
  assert(rxRequestModel.isModel(originAction))
  const network = await spawnReducerWithoutPromise(dmz, originAction)
  replyPromise() // allows spawnReducer to be reused by deploy
  return network
}
const spawnReducerWithoutPromise = (dmz, originAction) => {
  assert(dmzModel.isModel(dmz))
  // TODO reject if spawn requested while deploy is unresolved
  // may reject any actions other than cancel deploy while deploying ?
  let { alias, spawnOpts } = originAction.payload
  const { network, validators } = dmz
  const covenantId = covenantIdModel.create('unity')
  const childDmz = dmzModel.create({
    network: networkModel.create(),
    covenantId,
    ...spawnOpts,
    validators,
  })
  debug(`spawn alias: ${alias}`)
  alias = !alias ? autoAlias(network) : alias
  assert(!alias.includes('/'), `No / character allowed in "${alias}"`)
  if (alias === '.' || alias === '..') {
    throw new Error(`Alias uses reserved name: ${alias}`)
  }
  if (network[alias]) {
    throw new Error(`childAlias exists: ${alias}`)
  }
  // TODO insert dmz.getHash() into create() to generate repeatable randomness
  // TODO use chain key for signing

  const genesis = blockModel.create(childDmz)
  const payload = { genesis, alias, originAction }
  const genesisRequest = actionModel.create('@@GENESIS', payload)
  const address = genesis.provenance.getAddress()

  const nextNetwork = {}
  let channel = channelModel.create(address, './')
  channel = channelProducer.txRequest(channel, genesisRequest)
  nextNetwork[alias] = channel
  return network.merge(nextNetwork)
}

export { spawn, spawnReducer, spawnReducerWithoutPromise }
