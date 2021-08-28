import { assert } from 'chai/index.mjs'
import last from 'lodash.last'
import {
  blockPrint,
  interPrint,
  headerPrint,
  networkPrint,
  print,
} from './printer'
import { blockModel, interblockModel } from '../../../w015-models'
import { setTap } from '../../../w004-needle'
import Debug from 'debug'

const createTap = (prefix = 'interblock:blocktap') => {
  let isOn = false
  const on = () => (isOn = true)
  const off = () => (isOn = false)
  const debugBase = Debug(prefix)
  const cache = {}

  const debugTran = debugBase.extend('t')
  const interblockTransmit = (interblock) => {
    if (!isOn) {
      return
    }
    const formatted = interblockPrint(interblock)
    debugTran(formatted)
  }

  const debugPool = debugBase.extend('p')
  const interblockPool = (interblock) => {
    if (!isOn) {
      return
    }
    const formatted = interblockPrint(interblock)
    debugPool(formatted)
  }

  const interblockPrint = (interblock) => {
    assert(interblockModel.isModel(interblock))
    let msg = msg //chalk.yellow('LIGHT')
    // let forPath = chalk.gray(getPath(interblock, cache))
    let forPath = getPath(interblock, cache)
    const remote = interblock.getRemote()
    if (remote) {
      // msg = chalk.yellow('HEAVY')
    }
    const formatted = interPrint(interblock, msg, forPath, 'bgYellow', 'yellow')
    return formatted
  }
  const lockTimes = new Map()
  const lock = (address, lockStart) => {
    const chainId = address.getChainId()
    const workStart = Date.now()
    lockTimes.set(chainId, { lockStart, workStart })
  }

  const debugBloc = debugBase.extend('b')
  const block = (block) => {
    assert(blockModel.isModel(block))
    const chainIdRaw = block.provenance.getAddress().getChainId()
    const isNewChain = !cache[chainIdRaw]
    const isDuplicate =
      cache[chainIdRaw] && cache[chainIdRaw].some((b) => b.equals(block))
    insertBlock(block, cache)
    if (!isOn) {
      return
    }
    if (isDuplicate) {
      return
    }
    const path = getPath(block, cache)
    const formatted = blockPrint(block, path, isNewChain, isDuplicate)
    const { lockStart, workStart } = lockTimes.get(block.getChainId())
    const lockTime = Date.now() - lockStart
    const workTime = Date.now() - workStart
    const timeText = isDuplicate ? `NOCHANGE time` : `BLOCK time`
    // debugBloc(timeText, `total: ${lockTime} ms work: ${workTime} ms`)
    debugBloc(formatted)
  }
  let blockCount = 0
  let chainCount = 0
  const insertBlock = (block, cache) => {
    const chainId = block.provenance.getAddress().getChainId()
    if (!cache[chainId]) {
      cache[chainId] = []
      chainCount++ // TODO decrement on delete chain
    }
    if (!cache[chainId].some((b) => b.equals(block))) {
      cache[chainId].push(block)
      blockCount++
    }
  }

  const getPath = (block, cache) => {
    block = last(cache[block.provenance.getAddress().getChainId()])
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
        const parent = last(cache[parentChainId])
        assert(blockModel.isModel(parent), `Hole in pedigree`)
        const name = parent.network.getAlias(child.provenance.getAddress())
        path.unshift(name)
        child = parent
        // TODO detect if address already been resolved ?
      }
    }
    if (loopCount >= 10) {
      debugBase('Path over loopCount')
    }
    const concat = path.join('/')
    if (!concat) {
      return '/'
    }
    return concat
  }
  const getLatest = (alias) => {
    // TODO deal with a absolute path alias being provided
    let latest
    Object.values(cache).some((chainArray) => {
      const block = last(chainArray)
      const parentChannel = block.network['..']
      if (parentChannel.address.isRoot() && alias === '/') {
        assert(!latest)
        latest = block
        return true
      }
      const { heavy } = parentChannel
      if (heavy && heavy.getOriginAlias() === alias) {
        assert(!latest)
        latest = block
        return true
      }
    })
    return latest
  }
  const printNetwork = (network, msg = 'NEEDLEBLOCK') => {
    let alias = 'UNKNOWN'
    if (network['..'].address.isRoot()) {
      alias = '/'
    } else if (network['..'].heavy) {
      alias = network['..'].heavy.getOriginAlias()
    }
    const block = getLatest(alias)
    const messages = [headerPrint(block, alias)]
    messages[0].msg = msg //chalk.green(msg)
    messages.push(...networkPrint(network))
    return print(messages)
  }
  const getBlockCount = () => blockCount
  const getChainCount = () => chainCount
  const tap = {
    on,
    off,
    lock,
    block,
    interblockTransmit,
    interblockPool,
    getLatest,
    printNetwork,
    getBlockCount,
    getChainCount,
  }
  setTap(tap) // TODO handle multiple taps
  return tap
}
export { createTap }
