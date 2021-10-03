import assert from 'assert-fast'
import last from 'lodash.last'
import { standardize } from '../modelUtils'
import { channelModel } from './channelModel'
import { addressModel } from './addressModel'
import { rxRequestModel } from '../transients/rxRequestModel'
import { rxReplyModel } from '../transients/rxReplyModel'
import { reject } from '../../../w002-api'
import Debug from 'debug'
import { interblockModel } from '.'
const debug = Debug('interblock:models:network')

const schema = {
  title: 'Network',
  // description: `All communication in and out of this blockchain.`,
  type: 'object',
  required: ['..', '.'],
  additionalProperties: false,
  minProperties: 2,
  patternProperties: { '(.*?)': channelModel.schema },
}

const networkModel = standardize({
  schema,
  create(channels = {}) {
    const parent =
      channels['..'] || channelModel.create(addressModel.create(), '..')
    const loopbackAddress = addressModel.create('LOOPBACK')
    const self = channels['.'] || channelModel.create(loopbackAddress, '.')
    assert(self.address.isLoopback())
    return networkModel.clone({
      ...channels,
      '..': parent,
      '.': self,
    })
  },
  logicize(instance) {
    assert(!instance[undefined])
    const _aliases = Object.keys(instance)
    Object.freeze(_aliases)
    assert(_aliases.includes('..'))
    assert(_aliases.includes('.'))
    assert(channelModel.isModel(instance['.']), 'channel invalid')
    assert(instance['.'].systemRole === '.', `self not loopback channel`)

    // TODO make this a completely fair scheduler using pseudo randomization
    const rxReply = () => {
      for (const alias of _aliases) {
        const channel = instance[alias]
        let reply = channel.rxReply()
        if (!reply) {
          continue
        }
        if (channel.address.isInvalid()) {
          assert.strictEqual(reply.type, '@@REJECT')
          const error = new Error(`Path invalid: ${alias}`)
          const rejection = reject(error, reply.request)
          reply = rxReplyModel.clone(rejection)
        }
        // TODO find out if alias is used anywhere
        return { alias, event: reply, channel }
      }
    }
    const rxRequest = () => {
      for (const alias of _aliases) {
        const channel = instance[alias]
        const request = channel.rxRequest()
        if (!request) {
          continue
        }
        assert(channel.address.isResolved() || channel.address.isLoopback())
        // TODO find out if alias is used anywhere
        return { alias, event: request, channel }
      }
    }

    const rxSelf = () => {
      // not included in rx() since it is always exhausted each run
      const loopback = instance['.']
      const action = loopback.rxReply() || loopback.rxRequest()
      return action
    }
    // TODO find why any op needs to get all aliases out anyway
    const getAliases = () => _aliases
    let _resolvedAliases
    const getResolvedAliases = () => {
      if (!_resolvedAliases) {
        _resolvedAliases = getAliases().filter(
          (alias) => alias !== '.@@io' && instance[alias].address.isResolved()
        )
      }
      return _resolvedAliases
    }

    const aliasMap = new Map()
    let aliasMapIndex = 0
    const getAlias = (address) => {
      // TODO return for self specially ? or is it never called ?
      assert(addressModel.isModel(address))
      assert(!address.isUnknown())
      const chainId = address.getChainId()
      if (!aliasMap.has(chainId)) {
        // TODO handle same address referred to twice as different aliases
        while (aliasMapIndex < _aliases.length) {
          const alias = _aliases[aliasMapIndex]
          aliasMapIndex++
          const aliasAddress = instance[alias].address
          if (!aliasAddress.isUnknown()) {
            const aliasChainId = aliasAddress.getChainId()
            aliasMap.set(aliasChainId, alias)
            if (chainId === aliasChainId) {
              break
            }
          }
        }
      }
      return aliasMap.get(chainId)
    }
    const getParent = () => instance['..']
    const includesInterblock = (interblock) => {
      // TODO handle provenance being deleted or reset ?
      assert(interblockModel.isModel(interblock))
      const { provenance } = interblock
      const alias = getAlias(provenance.getAddress())
      if (!alias) {
        return false
      }
      let lineageIncludes = false
      const channel = instance[alias]
      if (provenance.height <= channel.lineageHeight) {
        lineageIncludes = true
      }
      if (provenance.height === channel.lineageHeight) {
        const isTip = provenance.equals(last(channel.lineageTip).provenance)
        assert(isTip)
      }
      const remote = interblock.getRemote()
      if (remote && lineageIncludes) {
        if (provenance.height === channel.heavy.provenance.height) {
          assert(interblock.equals(channel.heavy))
        }
        return provenance.height <= channel.heavy.provenance.height
      }
      return lineageIncludes
    }
    const getResponse = (request) => {
      assert(rxRequestModel.isModel(request))
      const address = request.getAddress()
      const index = request.getIndex()
      const alias = getAlias(address)
      assert(instance[alias])
      const reply = instance[alias].replies[index]
      return reply
    }

    const txInterblockAliases = (previous = networkModel.create()) => {
      assert(networkModel.isModel(previous))
      const resolvedAliases = getResolvedAliases()
      const changedAliases = resolvedAliases.filter((alias) => {
        const channel = instance[alias]
        const previousAlias = previous.getAlias(channel.address)
        if (!previousAlias) {
          return true
        }
        const previousChannel = previous[previousAlias]
        return channel.isTxGreaterThan(previousChannel)
      })
      return changedAliases
    }

    const isNewChannels = (previous = networkModel.create()) => {
      // TODO ignore '.@@io' ?
      assert(networkModel.isModel(previous))
      const resolvedAliases = getResolvedAliases()
      const isNewChannels = resolvedAliases.some((alias) => {
        const { address } = instance[alias]
        const previousAlias = previous.getAlias(address)
        if (!previousAlias) {
          return true
        }
      })
      return isNewChannels
    }

    // TODO move to networkProducer ?
    const merge = (toMerge) => {
      assert.strictEqual(typeof toMerge, 'object')
      if (!Object.keys(toMerge).length) {
        return instance
      }
      return networkModel.clone({ ...instance, ...toMerge })
    }

    return {
      rxReply,
      rxRequest,
      rxSelf,
      getAliases,
      getResolvedAliases,
      getAlias,
      getParent,
      includesInterblock,
      getResponse,
      txInterblockAliases,
      isNewChannels,
      merge,
    }
  },
})

export { networkModel }
