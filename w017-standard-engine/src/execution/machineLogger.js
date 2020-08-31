const uuidv4 = require('uuid/v4')
const pad = require('pad/dist/pad.umd')
const machineLogger = (type, machine) => {
  const invocation = uuidv4()
  const startTime = Date.now()
  const debug = require('debug')(`interblock:machines:${pad(machine, 11)}`)
  debug(`INVOCATION: ${machine} -> ${type}`)
  let lastTime = startTime
  const history = []
  let initialized = false
  const writeTransition = (value, event, context) => {
    const timestamp = _dedupeTimestampForDynamoDb()
    const elapsedTime = timestamp - lastTime
    lastTime = timestamp
    const item = value
    history.push(item)
    if (!initialized) {
      initialized = true
      return
    }
    return logTransition(item)
  }
  const writeTermination = (result) => {
    const timestamp = _dedupeTimestampForDynamoDb()
    const elapsedTime = timestamp - startTime
    const item = {
      invocation,
      timestamp,
      type,
      machine,
      elapsedTime,
      state: 'TERMINATION',
      event: history,
    }
    return logTermination(item)
  }

  const dedupe = {}
  const _dedupeTimestampForDynamoDb = () => {
    let now = Date.now()
    while (dedupe[now]) {
      now++
    }
    dedupe[now] = true
    return now
  }
  const logTransition = (item) => {
    transitionCount++
    debug(`TRANSITION: ${pad(3, transitionCount)} %j`, item)
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
