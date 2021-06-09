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
const { version } = require('./package.json')
console.log(`version: `, version)

const {
  browserFactory,
  effectorFactory,
  awsFactory,
} = require('./w020-emulators')
const engine = require('./w017-standard-engine')
const apps = require('./w301-user-apps')

const checkModules = () => {
  const exp = {}
  exp.ajv = require('ajv')
  exp.ajvformats = require('ajv-formats')
  exp.debug = require('debug')
  exp.faker = require('faker')
  exp.fastdeepequal = require('fast-deep-equal')
  exp.fastjsonstablestringify = require('fast-json-stable-stringify')
  exp.fastjsonstringify = require('fast-json-stringify')
  exp.jsonschemafaker = require('json-schema-faker')
  exp.localforage = require('localforage')
  exp.lodash = require('lodash')
  exp.nodeobjecthash = require('node-object-hash')
  exp.objecthash = require('object-hash')
  exp.padleft = require('pad-left')
  exp.seedrandom = require('seedrandom')
  exp.serializeerror = require('serialize-error')
  exp.sodiumplus = require('sodium-plus')
  exp.uuid = require('uuid')
  exp.xstate = require('xstate')

  console.log('loaded')

  const { SodiumPlus } = exp.sodiumplus
  const load = async () => {
    const sodium = await SodiumPlus.auto()
    console.log(`libsodium backend: `, sodium.getBackendName())
    let random = await sodium.randombytes_buf(32)
    let hash = await sodium.crypto_generichash('hello world')
    console.log({
      random: random.toString('hex'),
      hash: hash.toString('hex'),
    })
    console.log('crypto test complete')
  }
  load()

  const assert = require('assert')
  let thrown = false
  try {
    assert()
  } catch (e) {
    thrown = true
  }
  if (!thrown) {
    throw new Error(
      'Assert cannot throw - this is essential for library operation'
    )
  }
  return exp
}

module.exports = {
  browserFactory,
  effectorFactory,
  awsFactory,
  engine,
  apps,
  checkModules,
}
