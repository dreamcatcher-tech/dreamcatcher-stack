const debug = require('debug')('dos-shell:commands:add')
const chalk = require('ansi-colors')
const { prompt } = require('enquirer')

module.exports = async ({ spinner, blockchain }, path) => {
  // TODO handle nested and remote paths
  debug(`add: %O`, path)
  const result = await blockchain.add(path)
  const { alias, chainId } = result
  return {
    out: `Added: ${chalk.red(alias)}
chainId: ${chalk.greenBright(chainId)}`,
  }
}

module.exports.help = `
This command will be overridden by each application.
It serves as the general action of creating a new entity
where the entity is specific to the application being executed.
When used in the native setting, it makes a blank datum chain.
Depending on the context, additional info may need to be provided to
create the child.
`
