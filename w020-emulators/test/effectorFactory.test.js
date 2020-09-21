const assert = require('assert')
const { effectorFactory } = require('..')
const pingpongConfig = require('../../w302-test-covenants/pingpong/interblock.config')
const debug = require('debug')('interblock:tests:effectorFactory')

describe('effector', () => {
  require('debug').enable('*metrology* *tests*')

  test('ping single', async () => {
    debug(`start`)
    const client = await effectorFactory()
    debug(`effector ready`)
    const pingStart = Date.now()
    const reply = await client.ping()
    debug(`reply: `, reply)
    assert.strictEqual(reply.type, 'PONG')
    debug(`pong received`)
    debug(`ping RTT: ${Date.now() - pingStart} ms`)

    await client.engine.settle()

    debug(`stop`)
    /**
     * 2020-05-11 736ms no crypto
     * 2020-05-27 1,542ms no crypto (much more interblock creation)
     *    100ms from caching validation templates
     *    100ms from using proxy to strip functions automatically
     *    0ms from moving to hash based caching
     *    0ms from fast stringify
     *    200ms logging off
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
     */
  })
  test.skip('ping many times', async () => {
    jest.setTimeout(10000)
    debug(`start`)
    const client = await effectorFactory()
    // client.engine.enableLogging()
    let count = 0
    const promises = []
    while (count < 100) {
      const reply = client.ping('.', { count })
      promises.push(reply)
      count++
      if (count % 10 === 0) {
        await reply
      }
    }
    const results = await Promise.all(promises)
    await client.engine.settle()
    assert(results.every((reply) => reply && reply.type === 'PONG'))
    assert(results.every((reply, index) => reply.payload.count === index))
    debug(`stop`)
    /**
     * 2020-05-11 7,209ms 100 pings, batchsize 10, 68 blocks in total
     * 2020-05-11 4,616ms 100 pings, batchsize 10, 36 blocks in total
     * 2020-06-02 2,521ms 100 pings, batchsize 10, 23 blocks in total
     * 2020-06-24 2,908ms 100 pings, batchsize 10, 23 blocks in total
     * 2020-09-05 5,496ms 100 pings, batchsize 10, 23 blocks in total move to whonix vm
     * 2020-09-09 4,211ms 100 pings, batchsize 10, 23 blocks in total tuning
     *
     */
  })
  test('create child', async () => {
    const client = await effectorFactory()
    reply = await client.add('child1')
    debug(`reply: `, reply)
    assert.strictEqual(reply.alias, 'child1')
    const { child1 } = client.getState().network
    assert.strictEqual(child1.address.getChainId(), reply.chainId)
  })
  test('ping created child', async () => {
    const client = await effectorFactory()
    await client.add('testChild')
    const reply = await client.ping('testChild')
    assert(reply)
    await client.engine.settle()
  })
  test.skip('cannot create same child twice', async () => {
    // TODO handle errors in the translator
    require('debug').enable('*metro* *shell* *tests* *translator')

    const client = await effectorFactory()
    await client.add('testChild')
    await assert.rejects(() => client.add('testChild'))
  })
})

describe('client connected to dev AWS', () => {})

describe('two clients connected to amazon communicating', () => {})

describe.skip('client fluent interface', () => {
  test('client ingests effects and generates pure blocks', async () => {
    const client = effectorFactory()
    await client.ls()
    await client.ls('/')
    client.mk('testChain')
    client.cd('testChain') // tests chaining promises, but only if affect the same path ?
    client.mk('toDelete')
    client.rm('toDelete')
    client.mv('testChain', 'movedTestChain')
  })

  test.todo('all commands await the ones before')
  test('parallel clients', () => {
    const client = boot()
    const forked = client.fork()
  })
  test('ping pong runs through one loop', async () => {
    /**
     * This test acts like the front end of the application, which interacts with the client.
     *
     * Given a covenant, a config, and the client, run the system in dev mode so that it:
     * 1. Instantiates two stores
     * 2. Resolves each ones relative aliases
     * 3. Dispatches actions into either
     * 4. Resolves a 2 stage promise: user > chain1 > chain2
     * 5. Allows state to be treated as one large filesystem state
     */
    const client = boot()
    await client.install(pingpongConfig, 'pingpong')
    client.cd('/apps/pingpong')
    const ping = actions.ping()
    const resultPromise = client.dispatch(ping, './ping') // make this default action of the app ?
    const state = client.cat('./ping') // recursive cat ?
    assert.strictEqual(state.ping.pingCount, 0)
    assert.strictEqual(state.pong.pongCount, 0)

    await resultPromise
    const stateAfter = client.getState()
    assert.strictEqual(stateAfter.ping.pingCount, 1)
    assert.strictEqual(stateAfter.pong.pongCount, 1)
    assert.strictEqual(result, 'ponged the ping')
  })
  test.todo('defaults to cwd if no address on action')
  test.todo('can connect two clients to the same dev instance')
  test('connects to testnet and mainnet', async () => {
    const client = connect() // could specify what network in DOS you want ?
    if (client.isDevNet()) {
      // check can load from file paths
    } else if (client.isTestNet()) {
      // permanent network, but testing only - free, but deletes often
      // check cannot load from file paths.
      // check manifest
    } else if (client.isMainNet()) {
      // this is the real blockchain network - be careful
    }
  })
})
