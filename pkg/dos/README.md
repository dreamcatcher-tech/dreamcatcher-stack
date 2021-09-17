# DOS

The Distributed Operating System

/\*\*

- Ora uses the readline module, which is unavailable in the browser.
- This is the whole reason for having a webpack bundle that is built for the browser.
-
- All of ora must be included in the bundle, else the downstream bundler will attempt to
- bundle ora its own way, and will not work instantly.
-
- Target must be set to 'web' or else webpack thinks that readline is a node
- module which is available, so it makes no attempt to bundle using the fallbacks.
-
- Target 'web' causes the path and assert modules to be missing, so a fallback
- is added here, as well as an install of 'assert' which needs no fallback as the
- name is identical.
  \*/

readline: require.resolve('readline-browserify'),

## License

    DOS - the Distributed Operating System of the Dreamcatcher network

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
