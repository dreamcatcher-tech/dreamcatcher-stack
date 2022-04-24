import { assert } from 'chai/index.mjs'
describe('engine', () => {
  test('basic', async () => {
    const opts = {}
    const engine = await Engine.create(opts)
    // gives use a root chain, which is pierced
    // dispatch, so actions can be put in
    // and an interface that we can perform functions on the chain complex with

    // ? how does engine subscribe to new blocks ?
    // subscribe to the thing that announces to the dht that a new chain is made ?
    //    when receives new chain, it fetches the Pulse, and checks for responses ?
  })
})
