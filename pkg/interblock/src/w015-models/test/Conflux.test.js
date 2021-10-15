import { Conflux } from '..'
import Debug from 'debug'
import { assert } from 'chai/index.mjs'

const debug = Debug('interblock:tests:Conflux')
Debug.enable('')

describe('conflux', () => {
  test('basic', () => {
    const conflux = new Conflux([])
    assert.throws(() => (conflux.testMutability = ''))
    debug(conflux)
    conflux.includes()
  })
})
