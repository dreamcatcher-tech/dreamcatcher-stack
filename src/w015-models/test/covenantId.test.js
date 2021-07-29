import assert from 'assert'
const { covenantIdModel } = require('..')
describe('covenantId', () => {
  test('makes integrity out of name', () => {
    const covenantId = covenantIdModel.create('rhubarb')
    assert(covenantId)
    const blank = covenantIdModel.create()
    assert(blank)
  })
})
