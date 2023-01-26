import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('crm')

export const reducer = async (request) => {
  const { type, payload } = request
  assert.strictEqual(typeof type, 'string')
  assert.strictEqual(typeof payload, 'object')
  debug('reducer: ', type)
  switch (type) {
    case '@@INIT': {
      return
    }
  }
}
