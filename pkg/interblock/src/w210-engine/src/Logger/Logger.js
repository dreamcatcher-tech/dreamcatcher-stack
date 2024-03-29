import assert from 'assert-fast'
import { pulsePrint, getActiveChannelIds } from './printer'
import { Pulse } from '../../../w008-ipld/index.mjs'
import Debug from 'debug'
import { isBrowser } from 'wherearewe'

export class Logger {
  #options = {}
  #debugPulse
  #cache = new Map()
  #paths = new Map()
  #pulseCount = 0
  #chainCount = 0
  constructor(prefix = 'iplog') {
    this.#debugPulse = Debug(prefix)
  }
  setOptions(options = {}) {
    this.#options = options
  }
  isOn() {
    return this.#debugPulse.enabled
  }
  get Debug() {
    return Debug
  }
  async pulse(pulse) {
    this.#pulseCount++
    if (!this.isOn()) {
      return
    }
    assert(pulse instanceof Pulse)
    const chainId = pulse.getAddress().getChainId()
    const latest = this.#cache.get(chainId)
    const isNew = !latest && pulse.isGenesis()
    const activeChannelIds = await getActiveChannelIds(pulse)
    if (!activeChannelIds.length && !isNew) {
      return
    }
    const isDupe = latest && latest.cid.equals(pulse.cid)
    if (isDupe) {
      return
    }
    this.#insertPulse(pulse)
    const path = await this.#getPath(pulse)
    let formatted = await pulsePrint(pulse, path, isNew, isDupe, this.#options)
    if (this.#options.path && path !== this.#options.path) {
      return
    }
    if (isBrowser) {
      formatted = '\n' + formatted
    }
    this.#debugPulse(formatted)
  }
  #insertPulse(pulse) {
    const chainId = pulse.getAddress().getChainId()
    const latest = this.#cache.get(chainId)
    if (!latest) {
      this.#cache.set(chainId, pulse)
      this.#chainCount++ // TODO decrement on delete chain
      return
    }
    if (!latest.cid.equals(pulse.cid)) {
      this.#cache.set(chainId, pulse)
    }
  }
  async #getPath(pulse) {
    let count = 0
    let parentChannel
    let chainId
    const unknown = '(unknown)'
    let path = ''
    while (count++ < 10 && !this.#paths.has(chainId)) {
      parentChannel = await pulse.getNetwork().getParent()
      chainId = pulse.getAddress().getChainId()
      if (parentChannel.address.isRoot()) {
        path = '/' + path
        this.#paths.set(chainId, path)
        continue
      }
      if (!parentChannel.address.isResolved() || pulse.isGenesis()) {
        return unknown
      }
      let parentChainId = parentChannel.address.getChainId()
      if (!this.#cache.has(parentChainId)) {
        return unknown
      }
      const parent = this.#cache.get(parentChainId)
      const childAddress = pulse.getAddress()
      // TODO walking seems broken after removing path walking
      if (await parent.getNetwork().hasAddress(childAddress)) {
        let childChannel = await parent
          .getNetwork()
          .channels.getByAddress(childAddress)
        const [alias] = childChannel.aliases
        path = !path ? alias : alias + '/' + path
        pulse = parent
      }
    }
    return this.#paths.get(chainId) || unknown
  }
  get pulseCount() {
    return this.#pulseCount
  }
  get chainCount() {
    return this.#chainCount
  }
}
