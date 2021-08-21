import chalk from 'ansi-colors'
import Debug from 'debug'
const debug = Debug('dos:commands:validators')

export const validators = async ({ spinner, blockchain }, ...args) => {}

const help = `
View, change the validator set of a chain or group of chains.
Recursively change all validators of the chains children.
Validators must accept the role before the handover is complete.
Can be used to force a change if a chain has stalled.
`
