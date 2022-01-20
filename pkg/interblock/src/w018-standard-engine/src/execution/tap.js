import assert from 'assert-fast'
import {
  blockPrint,
  interPrint,
  headerPrint,
  networkPrint,
  print,
} from './printer'
import { Block, Interblock } from '../../../w015-models'
import { setTap } from '../../../w004-needle'
import Debug from 'debug'

const createTap = (prefix = 'interblock:blocktap') => {
  let _isOn = true
  let options = {}
  const on = (nextOptions = {}) => {
    _isOn = true
    options = nextOptions
  }
  const off = () => (_isOn = false)
  const debugBase = Debug(prefix)
  const isOn = () => _isOn && debugBase.enabled
  const cache = new Map()

  const debugTran = debugBase.extend('t')
  const interblockTransmit = (interblock) => {
    if (!isOn()) {
      return
    }
    const formatted = interblockPrint(interblock)
    debugTran(formatted)
  }

  const debugPool = debugBase.extend('p')
  const interblockPool = (interblock) => {
    if (!isOn()) {
      return
    }
    const formatted = interblockPrint(interblock)
    debugPool(formatted)
  }

  const interblockPrint = (interblock) => {
    assert(interblock instanceof Interblock)
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
    assert(block instanceof Block)
    const chainId = block.getChainId()
    const latest = cache.get(chainId)
    const isNewChain = !latest
    const isDuplicate = latest && latest.hashString() === block.hashString()
    if (isDuplicate) {
      return
    }
    insertBlock(block, cache)
    if (!isOn()) {
      return
    }
    const path = getPath(block, cache)
    const formatted = blockPrint(block, path, isNewChain, isDuplicate, options)
    const { lockStart, workStart } = lockTimes.get(block.getChainId())
    const lockTime = Date.now() - lockStart
    const workTime = Date.now() - workStart
    const timeText = isDuplicate ? `NOCHANGE time` : `BLOCK time`
    // debugBloc(timeText, `total: ${lockTime} ms work: ${workTime} ms`)
    if (options.path && path !== options.path) {
      return
    }
    debugBloc(formatted)
  }
  let blockCount = 0
  let chainCount = 0
  const insertBlock = (block, cache) => {
    const chainId = block.provenance.getAddress().getChainId()
    const latest = cache.get(chainId)
    if (!latest) {
      cache.set(chainId, block)
      chainCount++ // TODO decrement on delete chain
      blockCount++
      return
    }
    if (latest.hashString !== block.hashString()) {
      assert(latest.getHeight() < block.getHeight())
      cache.set(chainId, block)
      blockCount++
    }
  }

  const getPath = (block, cache) => {
    const unknown = '(unknown)'
    if (!block || !cache.has(block.getChainId())) {
      return unknown
    }
    const path = []
    let child = block
    let loopCount = 0
    while (child && loopCount < 10) {
      loopCount++
      const parentAddress = child.network.get('..').address
      if (parentAddress.isRoot()) {
        child = undefined
        path.unshift('')
      } else if (parentAddress.isUnknown()) {
        path.unshift(unknown)
        child = undefined
      } else {
        const parent = cache.get(parentAddress.getChainId())
        assert(parent, `Hole in pedigree`)
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
  const getBlockCount = () => blockCount
  const getChainCount = () => chainCount
  const tap = {
    on,
    off,
    lock,
    block,
    interblockTransmit,
    interblockPool,
    getBlockCount,
    getChainCount,
  }
  setTap(tap) // TODO handle multiple taps
  return tap
}
export { createTap }
