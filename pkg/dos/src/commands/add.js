import chalk from 'ansi-colors-browserify'
import Debug from 'debug'
const debug = Debug('dos:commands:add')

export const add = async ({ spinner, blockchain }, path, installer) => {
  // TODO handle nested and remote paths
  debug(`add path: %s installer: %s`, path, installer)
  let out = ``
  spinner.text = `adding ${path}...`
  const { alias, chainId } = await blockchain.add(path, installer)
  spinner.succeed(`added ${path}`).start()
  out += `Added: ${chalk.red(alias)}
 - chainId: ${chalk.greenBright(chainId)}\n`
  return {
    out: out.trim(),
  }
}

const help = `
This command will be overridden by each application.
It serves as the general action of creating a new entity
where the entity is specific to the application being executed.
When used in the native setting, it makes a blank datum chain.
Depending on the context, additional info may need to be provided to
create the child.
`
