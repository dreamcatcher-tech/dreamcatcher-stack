import { schemaToFunctions } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:schemaToFunctions')

describe('schemaToFunctions', () => {
  test('basic', () => {
    const actions = {
      add: {
        type: 'object',
        title: 'ADD',
        description: 'Add an element to this collection',
        additionalProperties: false,
        properties: {
          test: { type: 'string' },
        },
      },
    }
    const functions = schemaToFunctions(actions)
    const add = functions.add()
    debug(add)
    expect(add).toMatchSnapshot()
  })
})
