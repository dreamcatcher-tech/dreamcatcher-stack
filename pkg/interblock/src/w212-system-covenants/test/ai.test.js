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
  })
  test.only('nested async', async () => {
    const effect = async () => {
      return await new Promise((r) => setTimeout(r, 100, 'result'))
    }
    const reducer = async ({ type }) => {
      if (type === '@@INIT') {
        return
      }
      const result = await useAsync(effect, 'key')
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
    await engine.dispatch({ type: 'TEST' }, 'test')
  })
  it.todo('streams back results')
  it('runs a shell command', async () => {
    const engine = await Interpulse.createCI()
    await engine.bootHal()
    const actions = await engine.actions('.HAL')
    Debug.enable('iplog *:ai')
    const response = await actions.prompt('meow', 'key')
    console.log(response)

    // give a prompt to HAL, see it change directory.
    const prompt = 'change directory to the crm'

    const add = 'add a new customer'
    const nearly = 'addj bob' // if nearly a command, gpt should recognize
    /**
     * shell receives a prompt since nothing else matched.
     * shell then continues on the thread whose id it tracks.
     *    past blocks record the thread history, so it can be recreated
     * function call continuations are handled on chain
     */

    // how would it know what a customer is, if we didn't tell it ?
    // should the description of each path be part of the retrievals ?
    // want it to run several levels of ls to dig around, or look up everything from a table as a retrieval.

    // if you need to discover more functions, use ls at path to get more
  })
})
