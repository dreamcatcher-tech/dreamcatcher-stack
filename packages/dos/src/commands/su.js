import Enquirer from 'enquirer-browserify'
import Debug from 'debug'
const debug = Debug('dos:commands:su')

const timeout = (ms) => new Promise((res) => setTimeout(res, ms))

export const su = async (ctx, user) => {
  debug(user)
  if (!user) {
    throw new Error('must supply user name or chainId to elevate to')
  }
  // see if we know about this user already somehow ?
  const password = await Enquirer.prompt([{ name: `password` }])
  debug(password) //lol
}
