import chalk from 'ansi-colors'
import Debug from 'debug'
const debug = Debug('dos:commands:add')

export const add = async ({ spinner, blockchain }, ...paths) => {
  // TODO handle nested and remote paths
  debug(`add: %O`, paths)
  if (!paths.length) {
    paths = [undefined]
  }
  let out = ``
  for (const path of paths) {
    // TODO handle partial failure
    // TODO allow submitting multiple requests simultaneously
    spinner.text = `adding ${path}...`
    const { alias, chainId } = await blockchain.add(path)
    spinner.succeed(`added ${path}`).start()
    out += `Added: ${chalk.red(alias)}
 - chainId: ${chalk.greenBright(chainId)}\n`
  }
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
