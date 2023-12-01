import { Interpulse, useAsync } from '../..'
import dotenv from 'dotenv'
import { injectResponses } from '../src/ai'
import Debug from 'debug'
const debug = Debug('test')
dotenv.config({ path: '../../.env' })

describe('ai', () => {
  it('makes an api call to openai', async () => {
    // injectResponses('bob your uncle')
    const engine = await Interpulse.createCI()
    await engine.add('ai', { covenant: 'ai' })
    const actions = await engine.actions('ai')
    debug('ai actions', actions)

    const result = await actions.prompt('repeat this: "bob your uncle"', 'key')

    debug('result', result)
  }, 20000)
  test('nested async', async () => {
    const effect = async () => {
      return await new Promise((r) => setTimeout(r, 100, 'result'))
    }
    const reducer = async ({ type }) => {
      if (type === '@@INIT') {
        return
      }
      const result = await useAsync(effect)
      expect(result).toEqual('result')
    }
    const api = {
      test: {
        type: 'object',
        title: 'TEST',
        description: 'test',
        additionalProperties: false,
        required: [],
        properties: {},
      },
    }
    const engine = await Interpulse.createCI({
      overloads: { '/async': { api, reducer } },
    })
    await engine.add('test', {
      covenant: '/async',
      config: { isPierced: true },
    })
    Debug.enable('iplog')
    await engine.dispatch({ type: 'TEST', payload: {} }, 'test')
  })
  it.todo('streams back results')
})
