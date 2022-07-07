import assert from 'assert-fast'
import { pulsePrint, interPrint } from './printer'
import { Pulse } from '../../../w008-ipld'
import Debug from 'debug'

export class Logger {
  #isOn = true
  #options = {}
  #debugPulse
  #cache = new Map()
  #pulseCount = 0
  #chainCount = 0
  constructor(prefix = 'iplog') {
    this.#debugPulse = Debug(prefix)
  }
  on(options = {}) {
    this.#isOn = true
    this.#options = options
  }
  off() {
    this.#isOn = false
  }
  isOn() {
    this.#isOn && this.#debugPulse.enabled
  }

  interpulseAnnounce(interpulse) {
    if (!isOn()) {
      return
    }
    const formatted = this.interpulsePrint(interblock)
    debugTran(formatted)
  }

  interpulsePrint(interpulse) {
    assert(interpulse instanceof Interblock)
    let msg = msg //chalk.yellow('LIGHT')
    // let forPath = chalk.gray(getPath(interblock, cache))
    let forPath = getPath(interpulse, cache)
    const remote = interpulse.getRemote()
    if (remote) {
      // msg = chalk.yellow('HEAVY')
    }
    const formatted = interPrint(interpulse, msg, forPath, 'bgYellow', 'yellow')
    return formatted
  }
  async pulse(pulse) {
    assert(pulse instanceof Pulse)
    const chainId = pulse.getAddress().getChainId()
    const latest = this.#cache.get(chainId)
    const isNew = !latest && pulse.isGenesis()
    const isDupe = latest && latest.cid.equals(pulse.cid)
    if (isDupe) {
      return
    }
    this.#insertPulse(pulse)
    if (!this.isOn) {
      return
    }
    const path = await this.#getPath(pulse)
    const formatted = await pulsePrint(
      pulse,
      path,
      isNew,
      isDupe,
      this.#options
    )
    if (this.#options.path && path !== this.#options.path) {
      return
    }
    this.#debugPulse(formatted)
  }
  #insertPulse(pulse) {
    const chainId = pulse.getAddress().getChainId()
    const latest = this.#cache.get(chainId)
    const { cid } = pulse
    if (!latest) {
      this.#cache.set(chainId, { cid })
      this.#chainCount++ // TODO decrement on delete chain
      this.#pulseCount++
      return
    }
    if (!latest.cid.equals(pulse.cid)) {
      this.#cache.set(chainId, { cid })
      this.#pulseCount++
    }
  }
  async #getPath(pulse) {
    const unknown = '(unknown)'
    if (!this.#cache.has(pulse.getAddress().getChainId())) {
      return unknown
    }
    const path = []
    let child = pulse
    let loopCount = 0
    while (child && loopCount < 10) {
      loopCount++
      const parentChannel = await child.getNetwork().getParent('..')
      const { address } = parentChannel
      if (address.isRoot()) {
        child = undefined
        path.unshift('')
      } else if (address.isUnknown()) {
        path.unshift(unknown)
        child = undefined
      } else {
        const parent = this.#cache.get(address.getChainId())
        if (!parent) {
          console.log('hole in pedigree')
          return unknown
        }
        // const name = parent.getNetwork().getByAddress(child.getAddress())
        // path.unshift(name)
        // child = parent
        child = undefined
        // TODO detect if address already been resolved ?
      }
    }
    if (loopCount >= 10) {
      this.#debugPulse('Path over loopCount')
    }
    const concat = path.join('/')
    if (!concat) {
      return '/'
    }
    return concat
  }
  get pulseCount() {
    return this.#pulseCount
  }
  get chainCount() {
    return this.#chainCount
  }
}
