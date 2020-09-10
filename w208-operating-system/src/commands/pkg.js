const debug = require('debug')('dos:commands:pkg')

module.exports = async ({ spinner }, subcmd, ...args) => {
  debug(subcmd, args)
  await new Promise((resolve) => setTimeout(resolve, 2000))
  spinner.text = 'now with text'
  await new Promise((resolve) => setTimeout(resolve, 2000))
  spinner.succeed('stage 1 complete').start()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  spinner.fail(`stage 2 failed`).start()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  spinner.info('please try again later').start()
  await new Promise((resolve) => setTimeout(resolve, 2000))
}

module.exports.help = `
The platform package manager.  Use list --installed 
to list all applications installed on the system.
use list to show all available applications available for install.
Use search to narrow down the list of available packages.
Defaults to listing installed applications.
`
