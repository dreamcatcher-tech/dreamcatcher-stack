const assert = require('assert')
const { v4: uuidv4 } = require('uuid')
const pad = require('pad/dist/pad.umd')
const AWSXRay = require('aws-xray-sdk-core')
const util = require('util')

const awsLogger = (type, machine) => {
  assert.equal(typeof type, 'string')
  assert.equal(typeof machine, 'string')

  const segmentName = subsegmentNamer(`Invocation: ${machine}_${type}`)
  const machineSegment = AWSXRay.getSegment().addNewSubsegment(segmentName)
  machineSegment.addAnnotation('Machine', segmentName)

  const startTime = Date.now()
  let lastTime = startTime

  const debug = require('debug')(`interblock:aws:machines:${pad(machine, 11)}`)
  debug(`INVOCATION: ${segmentName}`)
  let currentSegment

  const writeTransition = (value, event, context) => {
    const timestamp = Date.now()
    const elapsedTime = timestamp - lastTime
    lastTime = timestamp
    const isInitialTransition = !currentSegment
    const segmentName = subsegmentNamer(value)
    if (isInitialTransition) {
      debug(`initial transition: %o`, segmentName)
      currentSegment = machineSegment.addNewSubsegment(segmentName)
      return
    }
    currentSegment.close()
    debug(`transition: %o`, segmentName)
    currentSegment = machineSegment.addNewSubsegment(segmentName)
    currentSegment.addMetadata('event', event, 'machine')
    currentSegment.addMetadata('context', context, 'machine')
    // TODO make subsegments for nested states
  }
  const writeTermination = (error) => {
    // TODO detect errors and raise these in the xray segment
    const timestamp = Date.now()
    const elapsedTime = timestamp - startTime
    debug(`termination after ${elapsedTime} ms`)
    currentSegment.close()
    machineSegment.close()
  }

  return { writeTransition, writeTermination }
}
let transitionCount = 0

const subsegmentNamer = (obj) => {
  let name = ''
  let next = obj
  while (typeof next === 'object') {
    let key = Object.keys(next)[0]
    if (name === '') {
      name = key
    } else {
      name += ': ' + key
    }
    next = next[key]
  }
  if (typeof obj === 'object') {
    name += ': '
  }
  name += next
  assert(!name.includes('{'))
  assert(!name.includes('}'))
  assert(!name.includes("'"))
  assert(!name.includes('"'))
  return name
}

module.exports = { awsLogger, subsegmentNamer }
