import pretty from 'pretty-ms'
import { evaluate } from '../eval'
import Debug from 'debug'
const debug = Debug('dos:commands:time')

export const time = async (ctx, ...args) => {
  const { blockchain } = ctx
  // TODO handle nested and remote paths

  if (args.length < 1) {
    throw new Error('Must supply command')
  }
  const [command, ...rest] = args
  debug(`time: `, command, rest)
  const lastBlockCount = blockchain.logger.pulseCount
  const lastChainCount = blockchain.logger.chainCount

  const start = Date.now()
  const res = (await evaluate(ctx, command, rest)) || {}
  res.out = res.out ? res.out + '\n' : ''
  const options = { compact: false, separateMilliseconds: true }
  res.out = res.out + `Time: ${pretty(Date.now() - start, options)}`

  const blockCount = blockchain.logger.pulseCount
  const chainCount = blockchain.logger.chainCount
  const diffBlocks = blockCount - lastBlockCount
  const diffChains = chainCount - lastChainCount

  res.out = res.out + ` [blocks: ${blockCount} chains: ${chainCount}]`
  res.out = res.out + ` [blocks++: ${diffBlocks} chains++: ${diffChains}]`
  return res
}

const help = `
Measure how long a command takes.
`
