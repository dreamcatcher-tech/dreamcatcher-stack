import { AsyncTrail } from '..'

describe('AsyncTrail', () => {
  it('can crush with no txs', async () => {
    const trail = AsyncTrail.createCI()
    expect(trail.txs.length).toBe(0)
    expect(() => trail.assertLogic()).not.toThrow()
  })
})
