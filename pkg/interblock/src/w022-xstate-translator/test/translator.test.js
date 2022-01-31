import chai, { assert } from 'chai/index.mjs'
import chaiAsPromised from 'chai-as-promised'
import { Machine } from 'xstate'
import { send, sendParent, respond, translator } from '..'
import { shell } from '../../w212-system-covenants'
import { RxReply, Address, Integrity } from '../../w015-models'
import { _hook as hook, interchain } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:tests:translator')
Debug.enable()
chai.use(chaiAsPromised)

const testMachine = Machine(
  {
    id: 'testMachine',
    initial: 'idle',
    states: {
      idle: {
        on: {
          RESEND: { actions: send() },
          RESEND_PARENT: { actions: sendParent() },
          INVOKE: { target: 'testInvoke' },
          INVOKE_INSTANT: { target: 'testInvokeInstant' },
          INVOKE_UNDEFINED: { target: 'testInvokeUndefinedResult' },
          TRANSITION_HOLD: 'transitionHold',
        },
      },
      testInvoke: {
        invoke: {
          src: 'invoker',
          onDone: { target: 'done', actions: 'respondOrigin' },
          onError: 'error',
        },
      },
      testInvokeInstant: {
        invoke: {
          src: 'instantInvoker',
          onDone: { target: 'done', actions: 'respondOrigin' },
          onError: 'error',
        },
      },
      testInvokeUndefinedResult: {
        invoke: {
          src: 'testInvokeUndefinedResult',
          onDone: 'done',
          onError: 'error',
        },
      },
      transitionHold: {},
      done: { type: 'final' },
      error: { type: 'final' },
    },
  },
  {
    actions: {
      respondOrigin: (context, event) => {
        debug(`respondOrigin`, event.type)
        return respond(event.data)
      },
    },
    services: {
      invoker: async (context, event) => {
        const reply = await interchain('testInvokeSelf')
        debug(`invoker first reply: %O`, reply)
        const second = await interchain('secondInvoke')
        debug(`invoker second reply: %O`, second)
        return second
      },
      instantInvoker: async (context, event) => {
        debug(`instantInvoker: %O`, event)
        return { result: 'instantResponse' }
      },
      testInvokeUndefinedResult: async (context, event) => {
        debug(`testInvokeUndefinedResult: %O`, event)
        return undefined
      },
    },
  }
)

describe('translator', () => {
  describe('transitions', () => {
    test('illegal transitions reject', async () => {
      const reducer = translator(testMachine)
      let state = await hook(() =>
        reducer(undefined, { type: 'TRANSITION_HOLD' })
      )
      assert.strictEqual(state.reduction.value, 'transitionHold')
      await assert.isRejected(
        hook(() => reducer(state.reduction, { type: 'TRANSITION_HOLD' })),
        'State: transitionHold does not accept'
      )
      debug(state)
    })
  })

  describe('ping', () => {
    test('self ping', async () => {
      const ping = shell.actions.ping()
      let state
      state = await hook(() => shell.reducer(undefined, ping))
      assert(state.isPending)
      assert.strictEqual(state.transmissions.length, 1)
      const [selfPing] = state.transmissions
      assert.strictEqual(selfPing.type, '@@PING')
      const address = Address.create('LOOPBACK')
      const reply = RxReply.create('@@RESOLVE', {}, address, 0, 0)
      const { type, to } = selfPing
      const acc = [{ type, to, reply }]
      state = await hook(() => shell.reducer(undefined, ping), acc)
      assert(!state.isPending)
      assert.strictEqual(state.transmissions.length, 1)
      const [donePing] = state.transmissions
      assert.strictEqual(donePing.type, 'done.invoke.shell.ping:invocation[0]')

      state = await hook(() => shell.reducer(state.reduction, donePing))
      assert.strictEqual(state.reduction.value, 'idle')
      assert.strictEqual(state.transmissions.length, 1)
      const [pingResolve] = state.transmissions
      assert.strictEqual(pingResolve.type, '@@RESOLVE')
      assert.deepEqual(pingResolve.payload, {})
    })
    test('remote ping', async () => {
      let state
      const pingRemote = shell.actions.ping('remote')
      state = await hook(() => shell.reducer(undefined, pingRemote))
      assert.strictEqual(state.transmissions.length, 1)
      const [remote] = state.transmissions
      assert.strictEqual(remote.type, '@@PING')
      assert.strictEqual(remote.to, 'remote')

      const replyPayload = { remoteReply: 'remoteReply' }
      const address = Address.create('TEST')
      const reply = RxReply.create('@@RESOLVE', replyPayload, address, 0, 0)
      const { type, to } = remote
      const acc = [{ type, to, reply }]
      state = await hook(() => shell.reducer(undefined, pingRemote), acc)
      assert.strictEqual(state.transmissions.length, 1)
      const [doneInvoke] = state.transmissions
      assert.strictEqual(
        doneInvoke.type,
        'done.invoke.shell.ping:invocation[0]'
      )

      state = await hook(() => shell.reducer(state.reduction, doneInvoke))
      assert.strictEqual(state.reduction.value, 'idle')
      assert.strictEqual(state.transmissions.length, 1)
      const [resolve] = state.transmissions
      assert.strictEqual(resolve.type, '@@RESOLVE')
      assert.deepEqual(resolve.payload, replyPayload)
    })
    test.todo('cascaded ping')
    test.todo('rejecting ping')
  })
  test.todo('send')
  test.todo('sendParent')
  test.todo('invoke')
  test.todo('spawn')
  test.todo('reject unknown action')
  test.todo('promise returning services')
  test.todo('service using setTimeout rejects')
  test.todo('automatic promises')
  test.todo('invoke is isolated between multiple instances')

  test.todo('dangling promises have no effect')
  test.todo('async service with no invokes is closed by reaper')
  test.todo('non async service works')

  test('async services simple', async () => {
    let result
    const accumulator = []
    const reducer = translator(testMachine)
    const tick = () => reducer(undefined, { type: 'INVOKE' })
    const execute = () => hook(tick, accumulator)
    result = await execute()

    assert.strictEqual(result.transmissions.length, 1)
    const [invoke] = result.transmissions
    assert.strictEqual(invoke.type, 'testInvokeSelf')

    debug(`sending first reply`)
    const accReply1 = createAccumulation(invoke, `first reply`)
    accumulator.push(accReply1)
    result = await execute()

    assert.strictEqual(result.transmissions.length, 1)
    const [secondInvoke] = result.transmissions
    assert.strictEqual(secondInvoke.type, 'secondInvoke')
    const accReply2 = createAccumulation(secondInvoke, `second reply`)
    accumulator.push(accReply2)
    result = await execute()

    assert.strictEqual(result.transmissions.length, 1)
    const [doneInvoke] = result.transmissions
    assert.strictEqual(
      doneInvoke.type,
      'done.invoke.testMachine.testInvoke:invocation[0]'
    )
    assert.strictEqual(result.reduction.value, 'testInvoke')
    assert(!result.isPending)
    const finalTick = () => reducer(result.reduction, doneInvoke)
    result = await hook(finalTick)

    // assert the original promise was resolved
    assert.strictEqual(result.transmissions.length, 1)
    const [resolve] = result.transmissions
    assert.strictEqual(resolve.type, '@@RESOLVE')
    assert.deepEqual(resolve.payload, accReply2.reply.payload)
  })
  test('instant services return', async () => {
    const reducer = translator(testMachine)
    const request = { type: 'INVOKE_INSTANT' }

    let nextState = await hook(() => reducer(undefined, request))
    assert.strictEqual(nextState.transmissions.length, 1)
    const [doneInvoke] = nextState.transmissions
    assert.strictEqual(
      doneInvoke.type,
      'done.invoke.testMachine.testInvokeInstant:invocation[0]'
    )

    nextState = await hook(() => reducer(nextState.reduction, doneInvoke))
    assert.strictEqual(nextState.transmissions.length, 1)
    assert.strictEqual(nextState.reduction.value, 'done')
    const [resolve] = nextState.transmissions
    assert.strictEqual(resolve.type, '@@RESOLVE')
    assert.deepEqual(resolve.payload, { result: 'instantResponse' })
  })
  test('undefined response from service', async () => {
    const reducer = translator(testMachine)
    const request = { type: 'INVOKE_UNDEFINED' }
    const nextState = await hook(() => reducer(undefined, request))
    debug(nextState)
    assert.strictEqual(nextState.transmissions.length, 1)
    const [doneInvoke] = nextState.transmissions
    assert.strictEqual(
      doneInvoke.type,
      'done.invoke.testMachine.testInvokeUndefinedResult:invocation[0]'
    )
    assert.deepEqual(doneInvoke.payload, {})
  })
  test.todo('instant return after multiple awaits')
  test.todo('multiple parallel invokes')
  test.todo('promise rejection')
  describe(`actions`, () => {
    test.todo(`exitPing action run by interpreter`)
  })
  describe(`respond`, () => {
    test.todo('respond to action after many invokes')
    test.todo('respond from machine overrides auto response')
    test.todo('only first respond is honored')
  })
  test.todo('error if functions stored in context or actions')
})

const createAccumulation = (raw, message) => {
  const { type, to } = raw
  const integrity = Integrity.create('TEST ' + type)
  const address = Address.create(integrity)
  const reply = RxReply.create('@@RESOLVE', { message }, address, 10, 10)
  return { type, to, reply }
}
