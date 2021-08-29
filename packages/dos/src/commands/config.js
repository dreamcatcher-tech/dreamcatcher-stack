const Fs = require('fs')
const Path = require('path')
const { promisify } = require('util')
const Os = require('os')
const debug = require('debug')('dos:commands:config')
const { getHomePath } = require('./cd')

// const readFile = promisify(Fs.readFile)
// const writeFile = promisify(Fs.writeFile)
const defaultConfigPath = Path.join(Os.homedir(), '.cmd-prototype')

const SubCommands = {
  async set(ctx, key, value) {
    debug('set', key, value)

    const configPath = ctx.configPath || defaultConfigPath
    const config = await readConfig(configPath)
    config[key] = value

    await writeFile(configPath, JSON.stringify(config))

    if (key.toLowerCase() === 'apiaddr') {
      const ipfs = (ctx.IpfsApi || IpfsApi)(value)
      const ipld = new Ipld(ipfs.block)
      const wd = await getHomePath(ipfs)
      return { ctx: { ipld, ipfs, wd } }
    }
  },

  async get(ctx, key) {
    debug('get', key)
    const config = await readConfig(ctx.configPath || defaultConfigPath)
    const value = key ? config[key] : config
    return { out: value }
  },
}

async function readConfig(path) {
  let config

  try {
    config = JSON.parse(await readFile(path))
  } catch (err) {
    debug('failed to read config', err)
  }

  return config || {}
}

module.exports = async function config(ctx, subCmd, ...args) {
  if (!SubCommands[subCmd]) throw new Error(`${subCmd}: subcommand not found`)
  return SubCommands[subCmd](ctx, ...args)
}
