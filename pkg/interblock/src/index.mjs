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
import './w000-level-db-shim'
import assert from 'assert-fast'
import { effectorFactory, awsFactory } from './w020-emulators'
import * as engine from './w018-standard-engine'
import * as system from './w212-system-covenants'
import * as apps from './w301-user-apps'
import Debug from 'debug'
const debug = Debug('interblock')

const checkModules = () => {
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
}
checkModules()
export { effectorFactory, awsFactory, engine, system, apps, Debug }
