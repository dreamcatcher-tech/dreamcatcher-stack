import cliui from 'cliui'
import * as commands from '.'
import Debug from 'debug'
const debug = Debug('dos:commands:help')

const strip = (str) => str.replace(/\n|\r|\r\n/g, ' ').trim()

export const help = (ctx) => {
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
