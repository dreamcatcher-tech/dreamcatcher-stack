import chai, { assert } from 'chai/index.mjs'
import chaiAsPromised from 'chai-as-promised'
import { effectorFactory } from '..'
import { jest } from '@jest/globals'
import Debug from 'debug'
const debug = Debug('interblock:tests:effectorFactory')
Debug.enable()
chai.use(chaiAsPromised)

describe('effector', () => {
  test('ping single', async () => {
    // Debug.enable('*tests*')
    const start = Date.now()
    debug(`start`)
    const shell = await effectorFactory()
    debug(`boot time: ${Date.now() - start} ms`)
    // client.enableLogging()
    debug(`effector ready`)
    const pingStart = Date.now()
    const payload = { test: 'ping' }
    const reply = await shell.ping('.', payload)
    debug(`reply: `, reply)
    assert.deepEqual(reply, payload)
    debug(`pong received`)
    debug(`ping RTT: ${Date.now() - pingStart} ms`)
    debug(`total test time: ${Date.now() - start} ms`)

    await shell.metro.settle()
    debug(`blockcount: ${shell.metro.getBlockCount()}`)

    const secondStart = Date.now()
    const secondReply = await shell.ping('.', payload)
    debug(`second pong received`)
    debug(`second ping RTT: ${Date.now() - secondStart} ms`)
    debug(`second blockcount: ${shell.metro.getBlockCount()}`)
    debug(`total test time: ${Date.now() - start} ms`)
    // BUT this is bad since still testing xstate time, not pure execution
    // also cold start includes compile costs for schemas
    await shell.shutdown()
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
     */
  })
  test.skip('ping many times', async () => {
    jest.setTimeout(10000)
    debug(`start`)
    const shell = await effectorFactory()
    // client.metrology.enableLogging()
    let count = 0
    const promises = []
    while (count < 100) {
      const reply = shell.ping('.', { count })
      promises.push(reply)
      count++
      if (count % 10 === 0) {
        await reply
      }
    }
    const results = await Promise.all(promises)
    await shell.shutdown()
    assert(results.every((reply) => reply && Number.isInteger(reply.count)))
    assert(results.every((reply, index) => reply.count === index))
    debug(`blockcount: `, shell.metro.getBlockCount())
    debug(`stop`)
    /**
     * 2020-05-11 7,209ms 100 pings, batchsize 10, 68 blocks in total
     * 2020-05-11 4,616ms 100 pings, batchsize 10, 36 blocks in total
     * 2020-06-02 2,521ms 100 pings, batchsize 10, 23 blocks in total
     * 2020-06-24 2,908ms 100 pings, batchsize 10, 23 blocks in total
     * 2020-09-05 5,496ms 100 pings, batchsize 10, 23 blocks in total move to whonix vm
     * 2020-09-09 4,211ms 100 pings, batchsize 10, 23 blocks in total tuning
     * 2021-01-25 2,116ms 100 pings, batchsize 10, 11 blocks in total - removed xstate
     * 2021-01-26 1,931ms 100 pings, batchsize 10, 11 blocks in total - removed birthblocks
     */
  })
  test('create child', async () => {
    const client = await effectorFactory()
    client.metro.enableLogging()
    const reply = await client.add('child1')
    debug(`reply: `, reply)
    assert.strictEqual(reply.alias, 'child1')
    const { network } = await client.latest()
    const child1 = network.get('child1')
    assert.strictEqual(child1.address.getChainId(), reply.chainId)
    await client.shutdown()
  })
  test('ping created child', async () => {
    const client = await effectorFactory()
    await client.add('testChild')
    const pingStart = Date.now()
    const reply = await client.ping('testChild')
    debug(`ping RTT: ${Date.now() - pingStart} ms`)
    assert(reply)
    await client.shutdown()
  })
  test('cannot create same child twice', async () => {
    // TODO handle errors in the translator
    const client = await effectorFactory()
    await client.add('testChild')
    await assert.isRejected(client.add('testChild'))
    await client.shutdown()
  })
})

describe('client connected to dev AWS', () => {})

describe('two clients connected to amazon communicating', () => {})
