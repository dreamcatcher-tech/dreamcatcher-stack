import { Interpulse } from '../..'
import equal from 'fast-deep-equal'
import dotenv from 'dotenv'
import { injectResponses } from '../src/ai'
import Debug from 'debug'
const debug = Debug('test')
dotenv.config({ path: '../../.env' })

describe('threads', () => {
  it('runs a shell command', async () => {
    // start a thread, which targets /
    const engine = await Interpulse.createCI()
    await engine.add('threads', { covenant: 'threads', state: { path: '/' } })

    const actions = await engine.actions('threads')
    // Debug.enable('iplog Interpulse')
    const stream = engine.subscribe('threads')
    print(stream)
    const response = await actions.user('ping me')
    // TODO add a test that does a tool call
    const state = (await engine.latest('threads')).getState().toJS()

    // give a prompt to HAL, see it change directory.
    const prompt = 'change directory to the crm'

    const add = 'add a new customer'
    const nearly = 'addj bob' // if nearly a command, gpt should recognize
  }, 30000)
  it.todo('rejects on concurrent prompt attempts')
})

const print = async (stream) => {
  let prior
  for await (const message of stream) {
    const state = message.getState().toJS()
    if (equal(state, prior)) {
      continue
    }
    prior = state
    // console.dir(state, { depth: Infinity })
  }
}
