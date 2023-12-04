import { Interpulse } from '../..'
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

  it.todo('streams back results')
})
