import { Interpulse } from '../..'
import { injectResponses } from '../src/ai'
import Debug from 'debug'
const debug = Debug('test')

describe('ai', () => {
  it.only('makes an api call to openai', async () => {
    injectResponses('bob your uncle')
    const engine = await Interpulse.createCI()
    await engine.add('ai', { covenant: 'ai' })
    const actions = await engine.actions('ai')
    debug('ai actions', actions)

    const result = await actions.prompt('repeat this: "bob your uncle"', [])

    debug('result', result)
  })
  it.todo('streams back results')
})
