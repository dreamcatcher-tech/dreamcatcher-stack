const assert = require('assert')
const { interpret } = require('xstate')
const { machineLogger } = require('./machineLogger')

let _logFactory = machineLogger

const thread = async (event, machine) => {
  const logger = _logFactory(event.type || event, machine.id)
  const service = interpret(machine, {
    execute: false,
  })

  const execution = new Promise((resolve, reject) => {
    let onError = false
    service.onTransition(async (state) => {
      if (state.value === 'error') {
        // allows errors to be reported
        onError = state.event
      }
      if (state.value !== 'error' && state.value !== 'done') {
        await logger.writeTransition(state.value, state.event, state.context)
      }
      service.execute(state)
    })
    service.onDone(async (result) => {
      if (onError) {
        const { type, data } = onError
        const error = { ...new Error(), ...data }
        error.message = data.message
        error.stack = data.stack
        error.name = data.name
        await logger.writeTermination(error)
        reject(error)
      } else {
        await logger.writeTermination()
        resolve(result.data)
      }
    })
  })
  service.start()
  service.send(event)
  return execution
}

const setLogger = (logger) => {
  assert.strictEqual(typeof logger, 'function')
  _logFactory = logger
}

module.exports = { thread, setLogger }
