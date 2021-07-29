import Debug from 'debug'
const debug = Debug('interblock:tests:translator')
import assert from 'assert'
const { Machine } = require('xstate')
const { send, sendParent, respond, translator } = require('..')
const { shell } = require('../../w212-system-covenants')
const { rxReplyModel, actionModel } = require('../../w015-models')
const { '@@GLOBAL_HOOK': hook, interchain } = require('../../w002-api')
require('debug').enable()
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
      await assert.rejects(
        () => hook(() => reducer(state.reduction, { type: 'TRANSITION_HOLD' })),
        (error) =>
          error.message.startsWith('State: transitionHold does not accept')
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
      assert.strictEqual(state.requests.length, 1)
      const [selfPing] = state.requests
      assert.strictEqual(selfPing.type, '@@PING')
      const request = actionModel.create(selfPing.type, selfPing.payload)
      const reply = rxReplyModel.create('@@RESOLVE', {}, request)

      state = await hook(() => shell.reducer(undefined, ping), [reply])
      assert(!state.isPending)
      assert.strictEqual(state.requests.length, 1)
      const [donePing] = state.requests
      assert.strictEqual(donePing.type, 'done.invoke.ping')

      state = await hook(() => shell.reducer(state.reduction, donePing))
      assert.strictEqual(state.reduction.value, 'idle')
      assert.strictEqual(state.replies.length, 1)
      assert.strictEqual(state.requests.length, 0)
      const [pingResolve] = state.replies
      assert.strictEqual(pingResolve.type, '@@RESOLVE')
      assert.deepStrictEqual(pingResolve.payload, {})
      assert.deepStrictEqual(pingResolve.request, ping)
    })
    test('remote ping', async () => {
      let state
      const pingRemote = shell.actions.ping('remote')
      state = await hook(() => shell.reducer(undefined, pingRemote))
      assert.strictEqual(state.requests.length, 1)
      const [remote] = state.requests
      assert.strictEqual(remote.type, '@@PING')
      assert.strictEqual(remote.to, 'remote')

      const { type, payload } = remote
      const replyPayload = { remoteReply: 'remoteReply' }
      const action = actionModel.create({ type, payload })
      const reply = rxReplyModel.create('@@RESOLVE', replyPayload, action)
      const accumulator = [reply]
      state = await hook(
        () => shell.reducer(undefined, pingRemote),
        accumulator
      )
      assert.strictEqual(state.requests.length, 1)
      const [doneInvoke] = state.requests
      assert.strictEqual(doneInvoke.type, 'done.invoke.ping')

      state = await hook(() => shell.reducer(state.reduction, doneInvoke))
      assert.strictEqual(state.reduction.value, 'idle')
      assert.strictEqual(state.replies.length, 1)
      const [resolve] = state.replies
      assert.strictEqual(resolve.type, '@@RESOLVE')
      assert.deepStrictEqual(resolve.payload, replyPayload)
      assert.deepStrictEqual(resolve.request, pingRemote)
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

    assert.strictEqual(result.requests.length, 1)
    const [invoke] = result.requests
    assert.strictEqual(invoke.type, 'testInvokeSelf')

    debug(`sending first reply`)
    const reply = createReply(invoke, `first reply`)
    accumulator.push(reply)
    result = await execute()

    assert.strictEqual(result.requests.length, 1)
    const [secondInvoke] = result.requests
    assert.strictEqual(secondInvoke.type, 'secondInvoke')
    const reply2 = createReply(secondInvoke, `second reply`)
    accumulator.push(reply2)
    result = await execute()

    assert.strictEqual(result.requests.length, 1)
    const [doneInvoke] = result.requests
    assert.strictEqual(doneInvoke.type, 'done.invoke.invoker')
    assert.strictEqual(result.reduction.value, 'testInvoke')
    assert(!result.isPending)
    const finalTick = () => reducer(result.reduction, doneInvoke)
    result = await hook(finalTick)

    // assert the original promise was resolved
    assert.strictEqual(result.replies.length, 1)
    const [resolve] = result.replies
    assert.strictEqual(resolve.type, '@@RESOLVE')
    assert.deepStrictEqual(resolve.request, { type: 'INVOKE' })
    assert.deepStrictEqual(resolve.payload, reply2.payload)
  })
  test('instant services return', async () => {
    const reducer = translator(testMachine)
    const request = { type: 'INVOKE_INSTANT' }

    let nextState = await hook(() => reducer(undefined, request))
    assert.strictEqual(nextState.requests.length, 1)
    const [doneInvoke] = nextState.requests
    assert.strictEqual(doneInvoke.type, 'done.invoke.instantInvoker')

    nextState = await hook(() => reducer(nextState.reduction, doneInvoke))
    assert.strictEqual(nextState.replies.length, 1)
    assert.strictEqual(nextState.reduction.value, 'done')
    const [resolve] = nextState.replies
    assert.strictEqual(resolve.type, '@@RESOLVE')
    assert.deepStrictEqual(resolve.request, request)
    assert.deepStrictEqual(resolve.payload, { result: 'instantResponse' })
  })
  test('undefined response from service', async () => {
    const reducer = translator(testMachine)
    const request = { type: 'INVOKE_UNDEFINED' }
    const nextState = await hook(() => reducer(undefined, request))
    debug(nextState)
    assert.strictEqual(nextState.requests.length, 1)
    const [doneInvoke] = nextState.requests
    assert.strictEqual(doneInvoke.type, 'done.invoke.testInvokeUndefinedResult')
    assert.deepStrictEqual(doneInvoke.payload, {})
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

const createReply = (raw, message) => {
  const { type, payload } = raw
  const action = actionModel.create({ type, payload })
  const reply = rxReplyModel.create('@@RESOLVE', { message }, action)
  return reply
}
