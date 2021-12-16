import { assert } from 'chai/index.mjs'
import { CovenantId } from '..'
describe('covenantId', () => {
  test('makes integrity out of name', () => {
    const covenantId = CovenantId.create('rhubarb')
    assert(covenantId)
    const blank = CovenantId.create()
    assert(blank)
  })
})
