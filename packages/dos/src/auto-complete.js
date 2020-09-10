const debug = require('debug')('dos:auto-complete')
const Chalk = require('ansi-colors')
const { withSpin } = require('./spinner')
const Commands = require('./commands')

class AutoComplete {
  constructor() {
    this._list = []
    this.getList = this.getList.bind(this)
  }

  // Update the auto-completion list based on the passed context
  async updateList({ wd, spinner }) {
    if (spinner) spinner.text = 'Updating auto-complete list'

    const cmdNames = Object.keys(Commands)
    let autoCompleteLinks = []

    this._list = cmdNames
  }

  // Given a string of chars typed by the user, return a list of auto-completion
  // options
  getList(s) {
    return s.includes(' ') ? this._list : Object.keys(Commands)
  }
}

exports.AutoComplete = AutoComplete

exports.withAutoComplete = (fn) => {
  return async function fnWithAutoComplete(ctx) {
    if (!ctx.autoComplete) {
      ctx.autoComplete = new AutoComplete()
      ctx.autoComplete.updateList = withSpin(ctx.autoComplete.updateList)
    }

    // Update the autocomplete list based on the new context
    try {
      await ctx.autoComplete.updateList(ctx)
    } catch (err) {
      console.warn(`${Chalk.yellow('⚠')} failed to update auto-complete list`)
      debug(err)
    }
    debug('auto-complete')
    return fn.apply(this, arguments)
  }
}
