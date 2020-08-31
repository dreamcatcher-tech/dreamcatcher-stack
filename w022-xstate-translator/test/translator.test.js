const debug = require('debug')('interblock:tests:translator')
const assert = require('assert')
const { Machine } = require('xstate')
const { respond, send, sendParent, invoke, translator } = require('..')
const { shell } = require('../../w212-system-covenants')
const { rxReplyModel, actionModel } = require('../../w015-models')
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
          onDone: 'done',
          onError: 'error',
        },
      },
      testInvokeInstant: {
        invoke: {
          src: 'instantInvoker',
          onDone: 'done',
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
    services: {
      invoker: async (context, event) => {
        const reply = await invoke('testInvokeSelf')
        debug(`invoker received: %O`, reply)
        const second = await invoke('secondInvoke')
        debug(`second: %O`, second)
        return reply
      },
      instantInvoker: async (context, event) => {
        debug(`instantInvoker: %O`, event)
        return 'instantResponse'
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
      require('debug').enable('*translator ')
      const reducer = translator(testMachine)
      let state = await reducer(undefined, 'TRANSITION_HOLD')
      assert.equal(state.xstate.value, 'transitionHold')
      delete state.actions

      await assert.rejects(() => reducer(state, 'TRANSITION_HOLD'))
      debug(state)
    })
  })
  describe('ping', () => {
    test('self ping', async () => {
      const ping = shell.actions.ping()
      let state
      state = await shell.reducer(undefined, ping)
      let { actions: a1, ...rest1 } = state
      assert.equal(rest1.xstate.value, 'ping')
      assert.equal(a1.length, 2)
      const [promise, a1Done] = a1
      assert.equal(a1Done.type, 'done.invoke.ping')
      assert.equal(promise.type, '@@PROMISE')

      state = await shell.reducer(rest1, a1Done)
      let { actions: a2, ...rest2 } = state
      assert.equal(rest2.xstate.value, 'idle')
      assert.equal(a2.length, 1)
      const [a2Resolve] = a2
      assert.equal(a2Resolve.type, '@@RESOLVE')
      assert.equal(a2Resolve.payload.type, 'PONG')
      assert.equal(a2Resolve.request, ping)

      assert(!state.originAction)
      assert.equal(state.promises.length, 0)
    })
    test('remote ping', async () => {
      let state
      const pingRemote = shell.actions.ping('remote')
      state = await shell.reducer(undefined, pingRemote)
      let { actions: a1, ...rest1 } = state
      assert.equal(rest1.xstate.value, 'ping')
      assert.equal(a1.length, 2)
      const [promise, invoke] = a1
      assert.equal(invoke.type, 'PING')
      assert.equal(invoke.to, 'remote')
      assert.equal(promise.type, '@@PROMISE')

      const { type, payload } = invoke
      const replyPayload = { remoteReply: 'remoteReply' }
      const action = actionModel.create({ type, payload })
      const reply = rxReplyModel.create('@@RESOLVE', replyPayload, action)
      state = await shell.reducer(rest1, reply)
      let { actions: a2, ...rest2 } = state
      assert.equal(rest2.xstate.value, 'idle')
      assert.equal(a2.length, 1)
      const [resolve] = a2
      assert.equal(resolve.type, '@@RESOLVE')
      assert.deepEqual(resolve.payload, replyPayload)
      assert.equal(resolve.request, pingRemote)
    })
    test('double ping', async () => {
      const ping = shell.actions.ping()
      const ping1 = { ...ping, sequence: 'firstPing' }
      let state
      state = await shell.reducer(undefined, ping1)
      let { actions: p1Request, ...rest1 } = state
      const [promise, p1Done] = p1Request

      state = await shell.reducer(rest1, p1Done)
      let { actions: p1Resolve, ...rest2 } = state
      assert(!state.originAction)
      assert.equal(state.promises.length, 0)

      const ping2 = { ...ping, sequence: 'secondPing' }
      state = await shell.reducer(rest2, ping2)
      let { actions: p2Request, ...rest3 } = state
      assert.equal(p2Request.length, 2)
      const [promise2, p2Done] = p2Request

      state = await shell.reducer(rest3, p2Done)
      let { actions: p2Resolve, ...rest4 } = state
      const [p2ResolveAction] = p2Resolve
      assert.equal(p2ResolveAction.type, '@@RESOLVE')
      assert.equal(p2ResolveAction.request, ping2)

      assert(!state.originAction)
      assert.equal(state.promises.length, 0)
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
    require('debug').enable('*')
    let actions, state
    const reducer = translator(testMachine)
    state = await reducer(undefined, 'INVOKE')

    actions = state.actions
    delete state.actions
    assert.equal(state.xstate.value, 'testInvoke')
    assert.equal(actions.length, 2)
    const [promise, invoke] = actions
    assert.equal(invoke.type, 'testInvokeSelf')
    assert.equal(promise.type, '@@PROMISE')
    assert.equal(promise.request, undefined)

    debug(`sending first reply`)
    const reply = createReply(invoke, `first reply`)
    state = await reducer(state, reply)

    actions = state.actions
    delete state.actions
    assert.equal(state.xstate.value, 'testInvoke')
    assert.equal(actions.length, 1)
    debug(`actions: `, actions)
    const [secondInvoke] = actions
    assert.equal(secondInvoke.type, 'secondInvoke')
    assert.equal(secondInvoke.payload.requestId, 1)
    const reply2 = createReply(secondInvoke, `second reply`)
    state = await reducer(state, reply2)

    // assert the original promise was resolved
    assert.equal(state.xstate.value, 'done')
    assert.equal(state.promises.length, 0)
    assert.equal(state.actions.length, 1)
    const [resolve] = state.actions
    debug(resolve)
    assert.equal(resolve.type, '@@RESOLVE')
    assert.deepEqual(resolve.request, { type: 'INVOKE' })
    assert.deepEqual(resolve.payload, {})
  })
  test('instant services return', async () => {
    require('debug').enable('*')
    const reducer = translator(testMachine)
    const request = { type: 'INVOKE_INSTANT' }
    let nextState = await reducer(undefined, request)
    assert.equal(nextState.actions.length, 2)
    const [promise, doneInvoke] = nextState.actions
    assert.equal(doneInvoke.type, 'done.invoke.instantInvoker')
    delete nextState.actions

    nextState = await reducer(nextState, doneInvoke)
    assert.equal(nextState.actions.length, 1)
    assert.equal(nextState.xstate.value, 'done')
    const [resolve] = nextState.actions
    assert.equal(resolve.request, request)
    assert.equal(resolve.type, '@@RESOLVE')
    assert.deepEqual(resolve.payload, {})
  })
  test('undefined response from service', async () => {
    require('debug').enable('*')
    const reducer = translator(testMachine)
    const request = { type: 'INVOKE_UNDEFINED' }
    const nextState = await reducer(undefined, request)
    assert.equal(nextState.actions.length, 2)
    const [promise, doneInvoke] = nextState.actions
    assert.equal(doneInvoke.type, 'done.invoke.testInvokeUndefinedResult')
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

  test('remote ping resolves promise', async () => {
    // ping a remote chain
    // observe promise returned to original caller
    // resolve remote ping
    // observe original promise resolved
  })
})

const createReply = (raw, message) => {
  const { type, payload } = raw
  const action = actionModel.create({ type, payload })
  const reply = rxReplyModel.create('@@RESOLVE', { message }, action)
  return reply
}
