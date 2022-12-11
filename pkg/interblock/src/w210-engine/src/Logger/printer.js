import assert from 'assert-fast'
import chalk from 'ansi-colors-browserify'
import pad from 'pad-left'
import prettyBytes from 'pretty-bytes'
import columnify from 'columnify'
import { Interpulse } from '../../../w008-ipld/index.mjs'
const grayUndefined = chalk.blackBright.bgWhiteBright('undefined')

const interPrint = (interpulse, msg, path, bg, fg) => {
  assert(interpulse instanceof Interpulse)
  msg = msg || 'INTERBLOCK'
  path = path || '(unknown)'
  bg = bg || 'bgYellow'
  fg = fg || 'yellow'
  const { provenance } = interpulse
  let height = provenance.height

  const chainIdRaw = provenance.getAddress().getChainId()
  let chainId = shrink(chainIdRaw, bg)
  const hashRaw = interpulse.hashString()
  let hash = shrink(hashRaw, 'bgWhiteBright', fg)
  let size = getSize(interpulse)

  const messages = [{ msg, height, path, chainId, hash, size }]

  const remote = interpulse.getRemote()
  if (remote) {
    msg = chalk.magenta('  └── channel')
    height = '-' // TODO replace with known height of remote
    path = chalk.gray(interpulse.getOriginAlias())
    size = getSize(remote)
    messages.push({ msg, height, path, size })

    msg = chalk.cyan('      └── tx:')
    Object.keys(remote.requests).forEach((index) => {
      height = index
      chainId = remote.requests[index].type
      hash = grayUndefined
      size = getSize(remote.requests[index])
      messages.push({ msg, height, chainId, hash, size })
    })

    msg = chalk.yellow('      └── rx:')
    Object.keys(remote.replies).forEach((index) => {
      height = index
      chainId = grayUndefined
      hash = remote.replies[index].type
      size = getSize(remote.replies[index])
      messages.push({ msg, height, chainId, hash, size })
    })
  }
  return print(messages)
}
const pulsePrint = async (pulse, path, isNew, isDupe, options = {}) => {
  const header = headerPrint(pulse, path, isNew, isDupe, options)
  const messages = [header]

  if (!isDupe && !options.headersOnly) {
    const networkLines = await networkPrint(pulse, options)
    messages.push(...networkLines)
  }
  const text = print(messages)
  return text
}
const PRINT_OPTIONS = {
  truncate: true,
  showHeaders: false,
  minWidth: 3,
  config: {
    msg: { minWidth: 9, maxWidth: 9 },
    height: { minWidth: 3, maxWidth: 3 },
    path: { minWidth: 28, maxWidth: 28 },
  },
}
const print = (messages) => {
  const formatted = columnify(messages, { ...PRINT_OPTIONS })
  return formatted
}
const headerPrint = (pulse, path, isNewChain, isDuplicate, options) => {
  const chainId = shrink(pulse.getAddress().getChainId())
  const height = chalk.green(pulse.provenance.height)
  const rawHash = pulse.cid.toString().substring(6)
  const hash = shrink(rawHash, 'bgWhiteBright', 'green')
  const msg = isDuplicate ? chalk.gray('NOCHANGE') : chalk.green('BLOCK')
  const pathMax = PRINT_OPTIONS.config.path.maxWidth
  path = path.length > pathMax ? path.substring(0, pathMax) : path
  path = chalk.blue.bold.bgWhiteBright(path)
  const header = { msg, height, path, chainId, hash }
  if (options.size) {
    header.size = getSize(pulse)
  }
  if (isNewChain) {
    header.msg = chalk.red('NEW_CHAIN')
  }
  return header
}
const networkPrint = async (pulse, options) => {
  const network = pulse.getNetwork()
  const messages = []
  const { txs, rxs } = network.channels
  const actives = [...txs, ...rxs]
  const io = await network.getIo()
  if (!io.tx.isEmpty() || !io.rx.isEmpty()) {
    actives.unshift(io.channelId)
  }
  const loopback = await network.getLoopback()
  if (!loopback.tx.isEmpty() || !loopback.rx.isEmpty()) {
    actives.unshift(loopback.channelId)
  }
  for (const channelId of actives) {
    const channel = await network.channels.getChannel(channelId)
    const { address } = channel
    let height = channelId // TODO show child, uplink, downlink, symlink, hardlink
    let chainId = grayUndefined
    let hash = grayUndefined
    if (channel.rx.tip) {
      const tip = channel.rx.tip.cid.toString().substring(6)
      hash = shrink(tip, 'bgWhiteBright', 'green')
    }
    if (address.isResolved()) {
      chainId = shrink(address.getChainId(), 'bgMagenta', 'whiteBright')
    }
    if (address.isRoot() || address.isLoopback()) {
      chainId = shrink(address.getChainId(), 'bgBlack', 'whiteBright')
      hash = ''
    }
    const msg = chalk.magenta('└─channel')
    const alias0 = channel.aliases[0]
    let path =
      channelId === 0
        ? '.'
        : channelId === 1
        ? '..'
        : channelId === 2
        ? '.@@io'
        : alias0 !== undefined
        ? alias0
        : '(other)'
    const channelHeader = {
      msg,
      height,
      path, //TODO show all aliase given to this channel
      chainId,
      hash,
    }
    if (options.size) {
      channelHeader.size = pad(prettyBytes(channel.serialize().length * 2), 12)
    }

    messages.push(channelHeader)
    const { tx, rx } = channel
    if (!rx.isEmpty()) {
      // beware that rx is always empty given that we drain it fully for now
    }
    if (channelId === io.channelId && network.piercings) {
      const msg = chalk.yellow('  └─rxIO')
      messages.push(...printStream(msg, network.piercings.reducer))
      messages.push(...printStream(msg, network.piercings.system))
    }
    if (!tx.isEmpty()) {
      if (!tx.system.isEmpty()) {
        const msg = chalk.cyan('  └─txSYS')
        const actions = printStream(msg, tx.system)
        messages.push(...actions)
      }
      if (!tx.reducer.isEmpty()) {
        const msg = chalk.cyan('  └─txRED')
        const actions = printStream(msg, tx.reducer)
        messages.push(...actions)
      }
    }
  }

  return messages
}
const printStream = (msg, stream) => {
  let index = stream.requestsLength - stream.requests.length
  const actions = []
  for (const request of stream.requests) {
    const chainId = request.type
    const hash = ''
    const height = chalk.cyan(index++)
    const path = '' //chalk.dim('since: -4')
    // const size = request ? getSize(request) : grayUndefined
    const action = { msg, height, path, chainId, hash }
    actions.push(action)
  }
  index = stream.repliesLength - stream.replies.length
  for (const reply of stream.replies) {
    const chainId = ''
    const hash = reply.type
    const height = chalk.cyan(index++)
    const path = '' //chalk.dim('since: -4')
    // const size = request ? getSize(request) : grayUndefined
    const action = { msg, height, path, chainId, hash }
    actions.push(action)
  }
  for (const settled of stream.promisedReplies) {
    const { reply, requestIndex } = settled
    const chainId = '(settled)'
    const hash = reply.type
    const height = chalk.cyan(requestIndex)
    const path = '' //chalk.dim('since: -4')
    const action = { msg, height, path, chainId, hash }
    actions.push(action)
  }
  return actions
}

const getSize = (model) => {
  const size = pad(prettyBytes(model.serialize().length * 2), 12)
  return size
}
const shrink = (string = '', bg = 'bgGreen', fg = 'whiteBright') => {
  const shrunk = ` ${pad(string, 9).substring(0, 9)} `
  return chalk[fg][bg].bold(shrunk)
}

export { pulsePrint, interPrint, headerPrint, networkPrint, print }
