import { assert } from 'chai/index.mjs'
import { shell } from '../../w212-system-covenants'
import { jest } from '@jest/globals'

describe('engine', () => {
  jest.setTimeout(100)
  beforeEach(() => {
    jest.resetModules()
  })

  describe('engine single stroke', () => {
    describe('interblock', () => {
      test.todo('trigger blocking for existing chain')
      test.todo('thread returns array of next invocations required')
      test.todo('promises resolved during action lifecycle')
      test.todo('rejects if chain does not exist')
    })

    describe('storage', () => {
      test.todo('cannot block more than once concurrently')
      test.todo('only block allowed in a non existent block pool is genesis')
      test.todo('effects not allowed if chain does not exist')
      test.todo('child chain creation forbidden for existing chains')
      test.todo('effects are deduplicated')
      test.todo('exception thrown if invalid lock submitted')
      test.todo('lock is exclusive')
      test.todo('checks funds available')
      test.todo('validates parent relationship on create')
      test.todo('lock cannot be used twice')
      test.todo('chain killing rejects subscriptions')
      test.todo('get a range of blocks')
      test.todo('get a specific block')
      test.todo('subscribe to 100 blocks in the future')
      test.todo('less that -1 fromHeight throws')
      test.todo('throw if permissions denied')

      describe('deleteChain', () => {
        test.todo('removes a chain')
        test.todo('removes the binary assosciated with a chain')
        test.todo('removes binary that has changed twice')
        test.todo('removes multiple blocks of a chain')
      })
      describe('storeBinary', () => {
        test.todo('place a binary')
        test.todo('reject if permissions wrong')
        test.todo('reject if chain missing')
      })
      describe('fetchBinary', () => {
        test.todo('return a binary from latest block')
        test.todo('return a binary from a previous state different to latest')
        test.todo('throw if chain missing')
        test.todo('throw if permissions missing')
      })
    })
  })
})
