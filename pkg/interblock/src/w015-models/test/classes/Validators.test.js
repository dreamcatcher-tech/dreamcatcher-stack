import { Validators } from '../../src/classes'
describe.only('Validators', () => {
  test('ci', () => {
    const validators = Validators.create()
    const js = validators.toJS()
  })
})
