/**
 * The problem with XRay logging:
 *
 * There is a maximum segment size of about 65kB for a segment.
 * Going over this will cause an error.  Hence, the logs need to be truncated,
 * but also, by not setting our segments as the base segment, even if this error occurs,
 * our segments still get thru.  Recommend leaving some headroom of about 30k for
 * our own segments, and only logging in the top level segments.
 *
 * The function appears to still complete successfully even if xray fails.
 *
 * Recommend having some basic console log messages for cloudwatch, so we can
 * know if the db call count is high.  The problem really is the design of interblock,
 * and it needs to make fewer calls to the databases.
 *
 * Or, choose to have a dedicated logs segment, and use the rest of the segments
 * purely for graphical state viewing and timing.
 *
 * Whatever segment is set as the current segment using AWSXRay.setSegment( seg )
 * will be where all database calls are logged into.  This can overload the segment
 * if many database calls are added.
 * Flush() can be used to send segments to the service immediately, and must be called
 * on close to avoid losing segments as they do not get transmitted to the service.
 * Flush() enables some segments to show as pending - seems to push data to service
 * as soon as possible.
 *
 * setStreamingThreshold should be set to 0 as there is a bug in the sdk implementation:
 * https://github.com/aws/aws-xray-sdk-node/issues/283
 *
 */

const assert = require('assert')
const AWSXRay = require('aws-xray-sdk-core')
AWSXRay.setStreamingThreshold(0)
AWSXRay.appendAWSWhitelist({
  services: {
    s3: {
      operations: {
        getObject: {
          request_parameters: ['Bucket', 'Key'],
        },
        putObject: {
          request_parameters: ['Bucket', 'Key'],
        },
      },
    },
  },
})
const debug = require('debug')('interblock:aws:xray')

const startXrayLogging = () => {
  const parentSegment = AWSXRay.getSegment().addNewSubsegment(`Logging`)
  parentSegment.flush()
  let logSegment

  const originalConsoleLog = require('debug').log

  const consoleLog = []
  let logLength = 0
  const closeLog = () => {
    if (logSegment) {
      logSegment.addMetadata(`console.log`, consoleLog, `debug`)
      logSegment.close() && logSegment.flush()
    }
    consoleLog.length = 0
    logLength = 0
    logSegment = undefined
  }

  require('debug').log = (msg) => {
    const timestamp = new Date().toISOString()
    const lines = msg.split(`\n`)
    const count = msg.length + lines.length * (timestamp.length + 1)
    const xraySegmentLimit = 60000 // 65kB is UDP packet maximum
    if (logLength + count > xraySegmentLimit) {
      closeLog()
    }
    if (!logSegment) {
      logSegment = parentSegment.addNewSubsegment(timestamp)
    }
    lines.map((line) => consoleLog.push(timestamp + ' ' + line))
    logLength += count
    // originalConsoleLog(msg)
  }

  return () => {
    require('debug').log = originalConsoleLog
    closeLog()
    parentSegment.close()
    parentSegment.flush()
  }
}

const parentSegments = []
const startXrayParentSegment = async (key, value, tracedFunction) => {
  debug(`startXrayParentSegment %o %o`, key, value)
  if (!parentSegments.length) {
    parentSegments.push(AWSXRay.getSegment())
  }
  const parentSegment = parentSegments[parentSegments.length - 1]
  const subsegment = parentSegment.addNewSubsegment(`${key}: ${value}`)
  parentSegments.push(subsegment)
  subsegment.addAnnotation(key, value)

  const closeXray = () => {
    assert(!subsegment.isClosed())
    subsegment.close()
    subsegment.flush()
    const parentSegment = parentSegments.pop()
    assert.equal(parentSegment, subsegment)
    debug(`closeXraySegment %o %o`, key, value)
  }

  try {
    await tracedFunction()
  } catch (e) {
    debug(`error: %O`, e)
    subsegment.addError(e)
  } finally {
    closeXray()
  }
}

const startXraySegment = async (key, value, tracedFunction) => {
  const parentSegment = parentSegments[parentSegments.length - 1]
  const segment = parentSegment.addNewSubsegment(`${key}: ${value}`)
  segment.addAnnotation(key, value)
  try {
    await tracedFunction()
  } catch (e) {
    segment.addError(e)
  } finally {
    segment.close()
    segment.flush()
  }
}

module.exports = { startXrayLogging, startXrayParentSegment, startXraySegment }
