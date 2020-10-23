const assert = require('assert')
const debug = require('debug')('interblock:models:network')
const _ = require('lodash')
const { standardize } = require('../utils')
const { channelModel } = require('./channelModel')
const { addressModel } = require('./addressModel')
const { provenanceModel } = require('./provenanceModel')

const schema = {
  title: 'Network',
  description: `All communication in and out of this blockchain.`,
  type: 'object',
  required: ['..', '.'],
  additionalProperties: false,
  minProperties: 2,
  patternProperties: { '(.*?)': channelModel.schema },
}

const networkModel = standardize({
  schema,
  create(channels = {}) {
    const parent = channels['..']
      ? channels['..']
      : channelModel.create(addressModel.create(), '..')
    const self = channels['.']
      ? channels['.']
      : channelModel.create(addressModel.create('LOOPBACK'), '.')
    assert(self.address.isLoopback())
    return networkModel.clone({
      ...channels,
      '..': parent,
      '.': self,
    })
  },
  logicize(instance) {
    assert(!instance[undefined])
    const aliases = Object.keys(instance)
    Object.freeze(aliases)
    assert(aliases.includes('..'))
    assert(aliases.includes('.'))
    assert(channelModel.isModel(instance['.']), 'channel invalid')
    assert(instance['.'].systemRole === '.', `self not loopback channel`)

    // TODO make this a completely fair scheduler using pseudo randomization
    const rxReply = () => _rx('reply')
    const rxRequest = () => _rx('request')

    const _rx = (type) => {
      let rx
      aliases.find((alias) => {
        const channel = instance[alias]
        const reply = channel.rxReply()
        const request = channel.rxRequest()
        let event
        switch (type) {
          case 'reply':
            event = reply
            break
          case 'request':
            event = request
            break
        }
        if (event) {
          rx = { alias, event, channel }
          return true
        }
      })
      return rx
    }

    const rxSelf = () => {
      // not included in rx() since it is always exhausted each run
      const self = instance['.']
      const action = self.rxReply() || self.rxRequest()
      return action
    }
    const rx = () => rxReply() || rxRequest()
    const getAliases = () => aliases
    const getResolvedAliases = () =>
      getAliases().filter(
        (alias) => instance[alias].address.isResolved() && alias !== '@@io'
      )

    // TODO try remove getAlias by returning channels with rx*()
    const getAlias = (address) => {
      // TODO return for self specially ? or is it never called ?
      assert(addressModel.isModel(address))
      assert(!address.isUnknown())

      const alias = getAliases().find((key) =>
        instance[key].address.equals(address)
      )
      return alias
    }
    const getParent = () => instance['..']
    const includesInterblock = (interblock) => {
      // TODO handle provenance being deleted or reset ?
      const { provenance } = interblock
      assert(provenanceModel.isModel(provenance))
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
        const isTip = provenance.equals(_.last(channel.lineageTip).provenance)
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
    const isResponseDone = (address, index) => {
      assert(addressModel.isModel(address))
      assert(Number.isInteger(index))
      assert(index >= 0)
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
    return {
      rxReply,
      rxRequest,
      rxSelf,
      rx,
      getAliases,
      getResolvedAliases,
      getAlias,
      getParent,
      includesInterblock,
      isResponseDone,
      txInterblockAliases,
      isNewChannels,
    }
  },
})

module.exports = { networkModel }
