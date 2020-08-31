const uuidv4 = require('uuid/v4')
const pad = require('pad/dist/pad.umd')
const AWSXRay = require('aws-xray-sdk-core')
const { assert } = require('dynamodb-lock-client/schema/failOpenConfig')

const awsLogger = (type, machine) => {
  assert.equal(typeof type, 'string')
  assert.equal(typeof machine, 'string')

  const segmentName = `${machine} -> ${type}`
  const machineSegment = AWSXRay.getSegment().addNewSubsegment(segmentName)
  machineSegment.addAnnotation('machine', machine)

  const startTime = Date.now()
  let lastTime = startTime

  const debug = require('debug')(`interblock:machines:${pad(machine, 11)}`)
  debug(`INVOCATION: ${machine} -> ${type}`)
  let currentSegment

  const writeTransition = (value, event, context) => {
    const timestamp = Date.now()
    const elapsedTime = timestamp - lastTime
    lastTime = timestamp
    if (!currentSegment) {
      currentSegment = machineSegment.addNewSubsegment(value)
      return
    }
    currentSegment.close()
    currentSegment = machineSegment.addNewSubsegment(value)
    // TODO make subsegments for nested states
  }
  const writeTermination = (error) => {
    // TODO detect errors and raise these in the xray segment
    const timestamp = Date.now()
    const elapsedTime = timestamp - startTime
    currentSegment.close()
    machineSegment.close()
  }

  return { writeTransition, writeTermination }
}
let transitionCount = 0

module.exports = { awsLogger }
