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

const parentSegments = []
const startXrayLoggingSegment = async (key, value, tracedFunction) => {
  debug(`startXraySegment %o %o`, key, value)
  if (!parentSegments.length) {
    parentSegments.push(AWSXRay.getSegment())
  }
  const parentSegment = parentSegments[parentSegments.length - 1]
  const subsegment = parentSegment.addNewSubsegment(`${key}: ${value}`)
  parentSegments.push(subsegment)
  subsegment.addAnnotation(key, value)
  const parentConsoleLog = require('debug').log
  const consoleLog = patchXrayLogger(parentConsoleLog)

  const closeXray = () => {
    assert(!subsegment.isClosed())
    let logTip = []
    let length = 0
    const xraySegmentLimit = 45000
    consoleLog.forEach((line) => {
      if (length + line.length < xraySegmentLimit) {
        logTip.push(line)
        length += line.length
      }
    })
    if (logTip.length < consoleLog.length) {
      logTip.push(`truncated by ${consoleLog.length - logTip.length} lines`)
    }
    subsegment.addMetadata('console.log', logTip, 'debug')
    subsegment.close()
    subsegment.flush()
    const parentSegment = parentSegments.pop()
    assert.equal(parentSegment, subsegment)
    require('debug').log = parentConsoleLog
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

const patchXrayLogger = () => {
  const consoleLog = []
  require('debug').log = (msg) => {
    const timestamp = new Date().toISOString()
    const lines = msg.split(`\n`)
    lines.map((line) => consoleLog.push(timestamp + ' ' + line))
  }
  return consoleLog
}

module.exports = { startXrayLoggingSegment, startXraySegment }
