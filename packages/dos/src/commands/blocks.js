import assert from 'assert'
import posix from 'path-browserify'
import { engine } from '../../../interblock/src/index' // in build, gets aliased as @dreamcatcher-tech/interblock
import Debug from 'debug'
const debug = Debug('dos:commands:blocks')
const { blockPrint } = engine

export const blocks = async (
  { blockchain },
  ...[path, start, stop, ...args]
) => {
  debug(`blocks %O`, path, start, stop, args)
  // TODO make this be an actual shell command that returns a binary answer
  // TODO make this handle .@@io special case
  // reason being so we can log all the user actions in the shell
  start = safeParseInt(start)
  stop = safeParseInt(stop)
  const { wd } = blockchain.context()
  path = path || wd
  const absPath = posix.resolve(wd, path)
  debug(`using path: %o`, absPath)

  let block
  const maxHeight = (await blockchain.latest(absPath)).provenance.height
  const topHeight = Number.isInteger(stop) ? stop : maxHeight
  let nextHeight = Number.isInteger(start) ? start : 0
  assert(nextHeight <= topHeight, `start must be less than or equal to stop`)
  let out = ''
  while (nextHeight <= topHeight) {
    // TODO fetch in parallel using payload layer
    block = await blockchain.latest(absPath, nextHeight)
    out += blockPrint(block, absPath) + `\n`
    nextHeight++
    debug(`next height: `, nextHeight)
  }
  return { out }
}
const safeParseInt = (toParse) => {
  try {
    return parseInt(toParse)
  } catch (e) {
    // not an integer
  }
}
const help = `
Show the blocks of any given blockchain.
If no chain ID or alias given, print the blocks of the 
blockchain at the cwd
`
