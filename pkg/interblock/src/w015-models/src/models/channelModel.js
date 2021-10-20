import assert from 'assert-fast'
import last from 'lodash.last'
import { standardize } from '../modelUtils'
import { addressModel } from './addressModel'
import { continuationModel } from './continuationModel'
import { remoteModel } from './remoteModel'
import { channelSchema } from '../schemas/modelSchemas'
import Debug from 'debug'
const debug = Debug('interblock:models:channel')

const channelModel = standardize({
  schema: channelSchema,
  create(address, systemRole = 'DOWN_LINK') {
    // TODO calculate systemRole from alias
    address = addressModel.clone(address)
    const remote = remoteModel.create({ address })
    const channel = {
      ...remote,
      systemRole,
    }
    return channelModel.clone(channel)
  },
  logicize(instance) {
    // TODO if reset address, must clear all remote requests, else promises break
    // TODO check no duplicate requests in channel - must be distiguishable
    // TODO why does duplicate detection in the channel matter ? isReplyFor() ?
    // TODO check that replies keys are always consequtive, and they match
    // the temporaryInterblocks array.  Could only be disjoint if came before
    // the current interblocks, else must be in order, and cannot be beyond
    // The order must match the interblocks for keys, so can walk the conflux
    const {
      address,
      replies,
      requests,
      precedent,
      systemRole,
      rxRepliesTip,
      tip,
      tipHeight,
    } = instance
    const isLoopback = systemRole === '.'

    if (address.isUnknown()) {
      assert.strictEqual(Object.keys(replies).length, 0)
      assert.strictEqual(typeof tip, 'undefined')
      assert.strictEqual(typeof tipHeight, 'undefined')
    }
    // TODO if this is pierce channel, ensure only requests are OOB effects ?

    if (isLoopback) {
      assert(address.isLoopback())
      assert.strictEqual(typeof tip, 'undefined')
      assert.strictEqual(typeof tipHeight, 'undefined')
      assert(precedent.isUnknown())
      const banned = ['@@OPEN_CHILD']
      const outs = Object.values(requests)
      assert(outs.every(({ type }) => !banned.includes(type)))
    }

    if (tip) {
      assert(!tip.isUnknown())
      assert(tipHeight >= 0)
    }
    const isTransmitting = () => requests.length || Object.keys(replies).length

    return {
      isTransmitting,
    }
  },
})
export { channelModel }
