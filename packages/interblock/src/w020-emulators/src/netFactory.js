import { assert } from 'chai/index.mjs'
import { interchain } from '../../w002-api'
import { actions } from '../../w021-dmz-reducer'
import { Machine, assign } from 'xstate'
import { socketModel, covenantIdModel } from '../../w015-models'
import {
  respond,
  send,
  sendParent,
  translator,
} from '../../w022-xstate-translator'
import Debug from 'debug'
const debug = Debug('interblock:covenants:net')
const { spawn, connect } = actions

const netFactory = (gateway) => {
  const config = {
    actions: {},
    guards: {},
    services: {
      addTransport: async (context, event) => {
        debug(`event: %o`, event)
        const { url } = event.payload
        const covenantId = covenantIdModel.create('socket')
        const config = { isPierced: true }
        const result = await interchain(spawn(url, { covenantId, config }))
        return result
      },
      rmTransport: async (context, event) => {
        // close all the websockets
        // reset the sqs queues back to defaults
      },
    },
  }
  const machine = Machine(
    {
      id: 'net',
      initial: 'idle',
      context: {},
      strict: true,
      states: {
        idle: {
          on: {
            ADD: 'addTransport',
            RM: 'rmTransport',
            PING: 'ping',
            PING_LAMBDA: 'pingLambda',
            VERSION: 'version',
          },
        },
        addTransport: {
          invoke: { src: `addTransport`, onDone: 'idle' },
        },
        rmTransport: {
          invoke: { src: `rmTransport`, onDone: 'idle' },
        },
        ping: {
          invoke: { src: `ping`, onDone: 'idle' },
        },
        pingLambda: {
          invoke: { src: `pingLambda`, onDone: 'idle' },
        },
        version: {
          entry: 'respondVersion',
          always: 'idle',
        },
        done: {
          id: 'done',
          type: 'final',
        },
        error: {
          id: 'error',
          type: 'final',
        },
      },
    },
    config
  )

  const actions = {
    add: (url) => {
      assert.strictEqual(typeof url, 'string')
      url = url.replace(/\//g, '|')
      return {
        type: `ADD`,
        payload: { url },
      }
    },
    rm: (url, force = false) => ({
      type: 'RM',
      payload: { url, force },
    }),
  }

  const schemas = {
    add: {
      type: 'object',
      description:
        'Add a new transport.  Will result in a child of this chain.',
      required: ['url'],
      properties: {
        url: { type: 'url' },
        type: socketModel.schema.properties.type,
        name: { type: 'string' },
      },
    },
    rm: {
      description: `Removes a transport.  Gracefully attempts to close the connection.
        Force will terminate immediately by deleting the chain`,
    },
  }

  const reducer = translator(machine)
  const covenantId = covenantIdModel.create('net')
  return { actions, schemas, reducer, covenantId }
}
export { netFactory }
