import { Interpulse, useAsync } from '../..'

describe('useAsync', () => {
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
    await engine.dispatch({ type: 'TEST', payload: {} }, 'test')
  })
})
