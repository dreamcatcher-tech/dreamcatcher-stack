const debug = require('debug')('interblock:covenants:net')
const assert = require('assert')
const dmzReducer = require('../../w021-dmz-reducer')
const { Machine, assign } = require('xstate')
const { spawn, connect } = dmzReducer.actions
const { socketModel, covenantIdModel } = require('../../w015-models')
const {
  respond,
  send,
  sendParent,
  invoke,
  translator,
} = require('../../w022-xstate-translator')

const config = {
  actions: {},
  guards: {},
  services: {
    addTransport: async (context, event) => {
      // checkSchema( event, schema.addTransport)
      debug(`event: %O`, event)
      const { name, type, url } = event.payload
      // TODO check that all children have different urls by calling loopback
      const covenantId = covenantIdModel.create('socket')
      const state = { type, url }
      await invoke(spawn(name, { covenantId, state }))
    },
    rmTransport: async () => {
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
          '@@INIT': 'idle',
          ADD: 'addTransport',
          RM: 'rmTransport',
          PING: 'ping',
          PING_LAMBDA: 'pingLambda',
          VERSION: 'version',
        },
      },
      addTransport: {
        invoke: {
          src: `addTransport`,
          onDone: 'idle',
        },
      },
      rmTransport: {
        invoke: {
          src: `addTransport`,
          onDone: 'idle',
        },
      },
      ping: {
        invoke: {
          src: `addTransport`,
          onDone: 'idle',
        },
      },
      pingLambda: {
        invoke: {
          src: `addTransport`,
          onDone: 'idle',
        },
      },
      version: {
        invoke: {
          src: `addTransport`,
          onDone: 'idle',
        },
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
  add: ({ name, type, url }) => ({
    type: `ADD`,
    payload: {
      name,
      type,
      url,
    },
  }),
  rm: (name, force = false) => {
    // remove a socket
  },
  ping: () => {},
  pingLambda: () => {},
  version: () => {},
}

const schemas = {
  add: {
    type: 'object',
    description: 'Add a new transport.  Will result in a child of this chain.',
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
  ping: {
    description: `Ping the transport, or the function.  Pings to chain are handled by the chain directly`,
  },
}

const reducer = translator(machine)
module.exports = { actions, schemas, reducer }
