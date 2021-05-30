const debug = require('debug')('dos:commands:su')

const commander = require('commander')
const program = new commander.Command()

const timeout = (ms) => new Promise((res) => setTimeout(res, ms))
const { prompt } = require('enquirer-browserify')

module.exports = async (ctx, user) => {
  debug(user)
  if (!user) {
    throw new Error('must supply user name or chainId to elevate to')
  }
  // see if we know about this user already somehow ?
  const password = await prompt([{ name: `password` }])
  debug(password) //lol
}
