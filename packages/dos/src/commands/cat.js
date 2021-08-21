import util from 'util'
import chalk from 'ansi-colors'
import posix from 'path-browserify'
import Debug from 'debug'
const debug = Debug('dos:commands:cat')

export const cat = async (
  { spinner, blockchain },
  ...[path = '.', ...args]
) => {
  // TODO specify slices into state
  // TODO watch for state changes
  // TODO move to be a shell command that returns a binary payload
  debug(`cat path: %O args: %O`, path, args)
  const { wd } = blockchain.context()
  const absolutePath = posix.resolve(wd, path)
  debug(`absolutePath`, absolutePath)
  const latest = await blockchain.latest(absolutePath)
  const { state } = latest
  const out = util.inspect(state, { colors: true, depth: null })
  return { out }
}

const help = `
Show the internal state of a chain.

TODO
Args for full state, or partial state, or a particular path in the state.
`
