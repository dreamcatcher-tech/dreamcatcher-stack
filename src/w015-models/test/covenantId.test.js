import assert from 'assert'
import { covenantIdModel } from '..'
describe('covenantId', () => {
  test('makes integrity out of name', () => {
    const covenantId = covenantIdModel.create('rhubarb')
    assert(covenantId)
    const blank = covenantIdModel.create()
    assert(blank)
  })
})
