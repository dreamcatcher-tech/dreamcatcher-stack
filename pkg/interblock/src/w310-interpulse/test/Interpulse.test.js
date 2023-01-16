import { Interpulse } from '..'
import Debug from 'debug'

const debug = Debug('interblock:tests:Interpulse')

describe('engine', () => {
  test('ping single', async () => {
    const start = Date.now()
    debug(`start`)
    const engine = await Interpulse.createCI()
    debug(`boot time: ${Date.now() - start} ms`)
    debug(`engine ready`)
    const pingStart = Date.now()
    const message = { test: 'ping' }
    const reply = await engine.ping('.', message)
    debug(`reply: `, reply)
    expect(reply).toEqual(message)
    debug(`pong received`)
    debug(`ping RTT: ${Date.now() - pingStart} ms`)
    debug(`total test time: ${Date.now() - start} ms`)
    debug(`pulseCount: ${engine.logger.pulseCount}`)

    const secondStart = Date.now()
    const secondReply = await engine.ping('.', message)
    expect(secondReply).toEqual(message)
    debug(`second pong received`)
    debug(`second ping RTT: ${Date.now() - secondStart} ms`)
    debug(`second pulseCount: ${engine.logger.pulseCount}`)
    debug(`total test time: ${Date.now() - start} ms`)
    debug(`stop`)
    /**
     * 2020-05-11 736ms no crypto
     * 2020-05-27 1,542ms no crypto (much more interblock creation)
     *    100ms from caching validation templates
     *    100ms from using proxy to strip functions automatically
     *    0ms from moving to hash based caching
     *    0ms from fast stringify
     *    200ms turned logging off
     * 2020-05-30 592ms (validate off, logging off properly, no deep freeze)
     * 2020-06-02 415ms (custom validator, model based hashing)
     *    336ms eager isDmzChangeable
     * 2020-06-24 361ms after change to dynamodb data model
     * 2020-07-03 499ms shell uses xstate and loopback instead of direct
     * 2020-07-03 418ms logging off
     * 2020-07-10 428ms real crypto sodium, 121ms ping RTT.  Previously was 1 second
     * 2020-09-05 760ms moved to whonix vm, 227ms RTT
     * 2020-09-09 1,169ms 358ms RTT - remove reference equality from models
     * 2020-09-09 1,088ms 295ms RTT - no printing
     * 2020-09-09 580ms 172ms RTT - s3 caching, machine reuse, immer correction
     * 2020-11-19 587ms 99ms RTT - hooks, pierce, 3 root blocks, 2 net blocks
     * 2020-11-20 478ms 77ms RTT - tuning
     * 2020-11-26 188ms 85ms RTT - turned off net creation
     * 2021-01-18 199ms total, 118ms RTT, blockcount 2 - removed proxy objects, add pending interpreter, ping reply goes via loopback
     * 2021-01-21 111ms total, 63ms RTT - fast-xstate interpreter only swapped out
     * 2021-01-25 108ms total, 49ms RTT - all machines using fast-xstate but still loading old machines
     * 2021-01-25 93ms total, 46ms RTT - xstate removed
     * 2021-01-26 88ms total, 46ms RTT - birthblocks removed
     * 2021-07-30 185ms total, 94ms RTT - move to es6, jest as es6, browerify some dependencies
     * 2021-07-30 96ms total, 75ms RTT - IN BROWSER
     * 2021-09-27 127ms total, 57ms RTT - no sig genesis or pierce, xeon proc
     * 2021-09-28 97ms total, 38ms RTT - assert-fast added
     * 2021-11-07 69ms total, 26ms RTT - blockcount 2, precedent protocol
     * 2021-12-27 89ms total, 70ms RTT - blockcount 2, models to classes
     * 2022-07-19 68ms total, 20ms RTT - blockcount 2, ipfs, move off whonix
     */
  })
  test('ping many times', async () => {
    debug(`start`)
    const engine = await Interpulse.createCI()
    debug(`booted`)
    const start = Date.now()
    let count = 0
    const promises = []
    while (count < 100) {
      const reply = engine.ping('.', { count })
      promises.push(reply)
      count++
      if (count % 10 === 0) {
        await reply
      }
    }
    const replies = await Promise.all(promises)
    expect(replies.every((reply, index) => reply.count === index)).toBeTruthy()
    debug(`pulseCount: `, engine.logger.pulseCount)
    debug(`stop %i ms`, Date.now() - start)
    /**
     * 2020-05-11 7,209ms 100 pings, batchsize 10, 68 blocks in total
     * 2020-05-11 4,616ms 100 pings, batchsize 10, 36 blocks in total
     * 2020-06-02 2,521ms 100 pings, batchsize 10, 23 blocks in total
     * 2020-06-24 2,908ms 100 pings, batchsize 10, 23 blocks in total
     * 2020-09-05 5,496ms 100 pings, batchsize 10, 23 blocks in total move to whonix vm
     * 2020-09-09 4,211ms 100 pings, batchsize 10, 23 blocks in total tuning
     * 2021-01-25 2,116ms 100 pings, batchsize 10, 11 blocks in total - removed xstate
     * 2021-01-26 1,931ms 100 pings, batchsize 10, 11 blocks in total - removed birthblocks
     * 2022-07-19 249ms 100 pings, batchsize 10, 11 blocks in total - ipfs, move off whonix
     */
  })
  test('create child', async () => {
    const engine = await Interpulse.createCI()
    const reply = await engine.add('child1')
    debug(`reply: `, reply)
    expect(reply.alias).toEqual('child1')
    const latest = await engine.latest('/')
    const child1 = await latest.getNetwork().getChild('child1')
    expect(child1.address.getChainId()).toBe(reply.chainId)
  })
  test('spawn many times', async () => {
    const engine = await Interpulse.createCI()
    let count = 0
    const awaits = []
    const start = Date.now()
    while (count < 10) {
      const result = engine.add(`child-${count}`)
      awaits.push(result)
      count++
      if (count % 10 === 0) {
        await result
      }
    }
    const bulkResult = await Promise.all(awaits)
    debug(`time for ${count} children: ${Date.now() - start}`)
    expect(bulkResult.every(({ chainId }) => chainId)).toBeTruthy()
    /**
     * need to see 1000 children spawned in under 5 seconds, with blocksize of 20kB
     *
     * 2020-07-17 1,000 seconds 800 children, 5.33 MB block size
     * 2022-07-19 26 seconds 800 children, negligible block size
     */
  })
})
