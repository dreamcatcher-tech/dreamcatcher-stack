const debug = require('debug')('dos:commands:pkg')

/**
 * Commands
 *
 * install - install an app by package name
 * list - list all packages, possibly with a search field
 * apps - list all packages which are apps
 */

module.exports = async ({ spinner, blockchain }, subcmd, ...args) => {
  debug(subcmd, args)
  // TODO move to commander for parsing, and shell commands for action
  switch (subcmd) {
    case '':
    case 'help':
      debug('help command')
      break
    case 'install':
      const dpkgPath = args[0]
      const installPath = args[1]
      if (typeof dpkgPath !== 'string') {
        throw new Error(`Invalid dpkg path: ${dpkgPath}`)
      }
      if (typeof installPath !== 'string') {
        throw new Error(`Invalid install path: ${installPath}`)
      }

      spinner.text = `Installing from path: ${dpkgPath} to: ${installPath}`
      spinner.start()
      debugger
      await blockchain.install(dpkgPath, installPath)
      debugger
      spinner.info(`Install complete`)
      break
  }
}

module.exports.help = `
The platform package manager.  Use list --installed 
to list all applications installed on the system.
use list to show all available applications available for install.
Use search to narrow down the list of available packages.
Defaults to listing installed applications.
`
