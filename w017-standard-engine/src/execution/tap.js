const assert = require('assert')
const _ = require('lodash')
const truncate = require('cli-truncate')
const pad = require('pad/dist/pad.umd')
const chalk = require('ansi-colors')
const { blockPrint, interPrint } = require('./printer')
const { blockModel, interblockModel } = require('../../../w015-models')

const createTap = (prefix = 'interblock:blocktap') => {
  let isOn = false
  const on = () => (isOn = true)
  const off = () => (isOn = false)
  const debugBase = require('debug')(prefix)
  const cache = {}
  const grayUndefined = chalk.gray('undefined')

  const debugTran = debugBase.extend('tran')
  const interblockTransmit = (interblock) => {
    if (!isOn) {
      return
    }
    const formatted = interblockPrint(interblock)
    debugTran(formatted)
  }

  const debugPool = debugBase.extend('pool')
  const interblockPool = (interblock) => {
    if (!isOn) {
      return
    }
    const formatted = interblockPrint(interblock)
    debugPool(formatted)
  }

  const interblockPrint = (interblock) => {
    assert(interblockModel.isModel(interblock))
    let msg = chalk.yellow('INTER_LIGHT')
    let forPath = chalk.gray(getPath(interblock, cache))
    const remote = interblock.getRemote()
    if (remote) {
      msg = chalk.yellow('INTER_HEAVY')
    }
    const formatted = interPrint(interblock, msg, forPath, 'bgYellow', 'yellow')
    return formatted
  }

  const debugBloc = debugBase.extend('bloc')
  const block = (block) => {
    assert(blockModel.isModel(block))
    const chainIdRaw = block.provenance.getAddress().getChainId()
    const isNewChain = !cache[chainIdRaw]
    const isDuplicate = !isNewChain && cache[chainIdRaw].includes(block)
    insertBlock(block, cache)
    if (!isOn) {
      return
    }
    const path = getPath(block, cache)
    const formatted = blockPrint(block, path, isNewChain, isDuplicate)
    debugBloc(formatted)
  }

  const insertBlock = (block, cache) => {
    const chainId = block.provenance.getAddress().getChainId()
    if (!cache[chainId]) {
      cache[chainId] = []
    }
    if (!cache[chainId].includes(block)) {
      cache[chainId].push(block)
    }
  }

  const getPath = (block, cache) => {
    block = _.last(cache[block.provenance.getAddress().getChainId()])
    const unknown = '(unknown)'
    if (!block) {
      return unknown
    }
    const path = []
    let child = block
    let loopCount = 0
    while (child && loopCount < 10) {
      loopCount++
      const { address } = child.network['..']
      if (address.isRoot()) {
        child = undefined
        path.unshift('')
      } else if (address.isUnknown()) {
        path.unshift(unknown)
        child = undefined
      } else {
        const parentChainId = address.getChainId()
        const parent = _.last(cache[parentChainId])
        assert(blockModel.isModel(parent), `Hole in pedigree`)
        const name = parent.network.getAlias(child.provenance.getAddress())
        path.unshift(name)
        child = parent
        // TODO detect if address already been resolved ?
      }
    }
    if (loopCount >= 10) {
      debug('Path over loopCount')
    }
    const concat = path.join('/')
    if (!concat) {
      return '/'
    }
    return concat
  }
  return {
    on,
    off,
    block,
    interblockTransmit,
    interblockPool,
  }
}
module.exports = { createTap }
