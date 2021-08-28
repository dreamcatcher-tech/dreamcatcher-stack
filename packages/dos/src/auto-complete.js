import chalk from 'ansi-colors-browserify'
import { withSpin } from './spinner'
import * as commands from './commands'
import Debug from 'debug'
const debug = Debug('dos:auto-complete')

export class AutoComplete {
  constructor() {
    this._list = []
    this.getList = this.getList.bind(this)
  }

  // Update the auto-completion list based on the passed context
  async updateList({ wd, spinner }) {
    if (spinner) spinner.text = 'Updating auto-complete list'

    const cmdNames = Object.keys(commands)
    let autoCompleteLinks = []

    this._list = cmdNames
  }

  // Given a string of chars typed by the user, return a list of auto-completion
  // options
  getList(s) {
    return s.includes(' ') ? this._list : Object.keys(commands)
  }
}

export const withAutoComplete = (fn) => {
  return async function fnWithAutoComplete(ctx) {
    if (!ctx.autoComplete) {
      ctx.autoComplete = new AutoComplete()
      ctx.autoComplete.updateList = withSpin(ctx.autoComplete.updateList)
    }

    // Update the autocomplete list based on the new context
    try {
      await ctx.autoComplete.updateList(ctx)
    } catch (err) {
      console.warn(`${chalk.yellow('⚠')} failed to update auto-complete list`)
      debug(err)
    }
    debug('auto-complete')
    return fn.apply(this, arguments)
  }
}
