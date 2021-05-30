/**
 * @license Interblock - the blockchain of the Dreamcatcher network

    Interblock - the blockchain of the Dreamcatcher network

    Copyright (C) 2020 - Dreamcatcher Command

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    The public key of Dreamcatcher Command is:

    -----BEGIN PGP PUBLIC KEY BLOCK-----

    mDMEX0X1URYJKwYBBAHaRw8BAQdAfSiD+Cz+dsp958OuZUzL5kW+udBVifFqQgEq
    m0Q7AgW0FERyZWFtY2F0Y2hlciBDb21tYW5kiJAEExYKADgWIQRY+Pn9EN5Sle4L
    dzHWHszY4ySBbAUCX0X1UQIbAwULCQgHAwUVCgkICwUWAgMBAAIeAQIXgAAKCRDW
    HszY4ySBbNZFAQDdx5mq78w3umOwcX+c4VpHA0M960EEKC4nQ8dTLZzu0AD+Mj/3
    GcX5U7eKqzadjN1DObEPV60MNeYjzfrc3zNogAy4OARfRfVREgorBgEEAZdVAQUB
    AQdA2jnJJRv4EsWxbzQRQSDsNQ3p4gv67pw9ZmDQKQ0sRSMDAQgHiHgEGBYKACAW
    IQRY+Pn9EN5Sle4LdzHWHszY4ySBbAUCX0X1UQIbDAAKCRDWHszY4ySBbADzAP9K
    nOxNNp/lRRuPOA0xp86pR9IgNNqT7psuuI0kGOH2bwEAktByKRYE8D4xjiKREgT5
    fNtp7TG4XeeOLbZWfld16gw==UALt
    -----END PGP PUBLIC KEY BLOCK-----

 */

// const {
//   browserFactory,
//   effectorFactory,
//   awsFactory,
// } = require('./w020-emulators')
// const engine = require('./w017-standard-engine')
// const apps = require('./w301-user-apps')
// module.exports = { browserFactory, effectorFactory, awsFactory, engine, apps }

const ajv = require('ajv')
const ansicolors = require('ansi-colors')
const assert = require('assert')
const clitruncate = require('cli-truncate')
const columnify = require('columnify')
const debug = require('debug')
const deepobjectdiff = require('deep-object-diff')
const dynamodblockclient = require('dynamodb-lock-client')
const faker = require('faker')
const fastdeepequal = require('fast-deep-equal')
const fastjsonstablestringify = require('fast-json-stable-stringify')
const fastjsonstringify = require('fast-json-stringify')
const iscircular = require('is-circular')
const localforage = require('localforage')
const lodash = require('lodash')
const nodeobjecthash = require('node-object-hash')
const objecthash = require('object-hash')
const pad = require('pad')
const prettybytes = require('pretty-bytes')
const rimraf = require('rimraf')
const securerandom = require('secure-random')
const seedrandom = require('seedrandom')
const serializeerror = require('serialize-error')
// const sodiumnative = require('sodium-native')
const sodiumplus = require('sodium-plus')
const supportscolor = require('supports-color')
const tar = require('tar')
const traverse = require('traverse')
const uuid = require('uuid')
const xstate = require('xstate')
console.log('loaded')

const { SodiumPlus } = sodiumplus
const sodium = SodiumPlus.auto()
console.log(`libsodium backend: `, sodium.getBackendName())

module.exports = {
  ajv,
  ansicolors,
  assert,
  clitruncate,
  columnify,
  debug,
  deepobjectdiff,
  dynamodblockclient,
  faker,
  fastdeepequal,
  fastjsonstablestringify,
  fastjsonstringify,
  iscircular,
  localforage,
  lodash,
  nodeobjecthash,
  objecthash,
  pad,
  prettybytes,
  rimraf,
  securerandom,
  seedrandom,
  serializeerror,
  // sodiumnative,
  sodiumplus,
  supportscolor,
  tar,
  traverse,
  uuid,
  xstate,
}
