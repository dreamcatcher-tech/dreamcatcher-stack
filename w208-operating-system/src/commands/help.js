const debug = require('debug')('dos-shell:commands:help')
const cliui = require('cliui')
const commands = require('.')
const dedent = require('dedent')

const strip = (str) => str.replace(/\n|\r|\r\n/g, ' ').trim()

module.exports = function help(ctx) {
  const ui = cliui()
  debug(`help: `, Object.keys(commands))
  ui.div(`Use the following commands (use "tab" for autocomplete):\n`)
  const help = Object.keys(commands).filter((cmd) => !!commands[cmd].help)
  help.forEach((cmd) => {
    ui.div(
      { text: cmd, width: 20, padding: [0, 0, 0, 0] },
      strip(commands[cmd].help)
    )
    ui.div()
  })

  const noHelp = Object.keys(commands).filter((cmd) => !commands[cmd].help)
  ui.div(`No help provided for:\n`)
  ui.div('    ' + noHelp.toString())
  ui.div()

  return { out: ui.toString() }
}

module.exports.help = `
Prints this message
`
