export * from './cd'
export * from './exit'
export * from './ls'
export * from './pwd'
export * from './version'
export * from './pkg'
export * from './clear'
export * from './error'
export * from './open'
export * from './login'
export * from './logout'
export * from './su'
export * from './add'
export * from './ln'
export * from './rm'
export * from './whoami'
export * from './search'
export * from './time'
export * from './ping'
export * from './reset'
export * from './dns'
export * from './cat'
export * from './net'
export * from './debug'
export * from './edit'
export * from './about'
export * from './blocks'
export * from './scrub'
export * from './namegen'
export * from './validators'
export * from './peer'
export * from './multiaddr'
export * from './mount'
export * from './help' // TODO change how imports work, as help command gets overridden by other exports

import Debug from 'debug'
const debug = Debug('dos:commands')
