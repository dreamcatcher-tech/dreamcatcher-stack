const debug = require('debug')('dos:commands:add')
const chalk = require('ansi-colors')
const { prompt } = require('enquirer-browserify')

module.exports = async ({ spinner, blockchain }, ...args) => {}

module.exports.help = `
View, change the validator set of a chain or group of chains.
Recursively change all validators of the chains children.
Validators must accept the role before the handover is complete.
Can be used to force a change if a chain has stalled.
`
