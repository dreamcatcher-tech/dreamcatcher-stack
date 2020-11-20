const { v4: uuidv4 } = require('uuid')
const pad = require('pad/dist/pad.umd')
const debugFactory = require('debug')
const machineLogger = (type, machine) => {
  const invocation = uuidv4()
  const debug = debugFactory(`interblock:machines:${pad(machine, 11)}`)
  debug(`INVOCATION: ${machine} -> ${type}`)
  const history = []
  let initialized = false
  const writeTransition = (value, event, context) => {
    const item = value
    history.push(item)
    if (!initialized) {
      initialized = true
      return
    }
    return logTransition(item)
  }
  const writeTermination = (result) => {
    const item = {
      invocation,
      type,
      machine,
      state: 'TERMINATION',
      event: history,
    }
    return logTermination(item)
  }

  const logTransition = (item) => {
    transitionCount++
    debug(`TRANSITION: ${pad(3, transitionCount)} %O`, item)
  }
  const logTermination = (item) => {
    debug(
      `TERMINATOR: ${item.machine} -> ${item.type} execution ended after ${item.elapsedTime}ms`
    )
  }
  return { writeTransition, writeTermination }
}
let transitionCount = 0

module.exports = { machineLogger }
