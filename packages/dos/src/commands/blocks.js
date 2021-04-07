const assert = require('assert')
const posix = require('path')
const debug = require('debug')('dos:commands:blocks')
const { engine } = require('@dreamcatcher-tech/interblock')
const { blockPrint } = engine

module.exports = async ({ blockchain }, ...[path, start, stop, ...args]) => {
  debug(`blocks %O`, path, start, stop, args)
  // TODO make this be an actual shell command that returns a binary answer
  // TODO make this handle .@@io special case
  // reason being so we can log all the user actions in the shell
  start = safeParseInt(start)
  stop = safeParseInt(stop)
  const { wd } = blockchain.getContext()
  path = path || wd
  const absolutePath = posix.resolve(wd, path)
  debug(`using path: %o`, absolutePath)

  // TODO set payload layer tasks in parallel to fetch all required
  const segments = absolutePath.split('/')
  debug(`path segment count: `, segments.length)
  while (segments.length) {
    // pop, shift, check if root
    const segment = segments.shift()
    if (!segment) {
      continue
    }
    if (!blockchain[segment]) {
      throw new Error(`invalid path: ${absolutePath} stopped on: ${segment}`)
    }
    debug('segment: ', segment)
    blockchain = blockchain[segment]
  }
  let block
  const maxHeight = blockchain.getState().provenance.height
  const topHeight = Number.isInteger(stop) ? stop : maxHeight
  let nextHeight = Number.isInteger(start) ? start : 0
  assert(nextHeight <= topHeight, `start must be less than or equal to stop`)
  let out = ''
  while (nextHeight <= topHeight) {
    block = blockchain.getState(nextHeight)
    out += blockPrint(block, absolutePath) + `\n`
    nextHeight++
    debug(`next height: `, nextHeight)
  }
  return { out }
}
const safeParseInt = (toParse) => {
  try {
    return parseInt(toParse)
  } catch (e) {}
}
module.exports.help = `
Show the blocks of any given blockchain.
If no chain ID or alias given, print the blocks of the 
blockchain at the cwd
`
