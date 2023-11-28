import { Interpulse, useAsync } from '../..'
import equal from 'fast-deep-equal'
import dotenv from 'dotenv'
import { injectResponses } from '../src/ai'
import Debug from 'debug'
const debug = Debug('test')
dotenv.config({ path: '../../.env' })

describe('threads', () => {
  it.skip('runs a shell command', async () => {
    // start a thread, which targets /
    const engine = await Interpulse.createCI()
    await engine.bootHal()

    const actions = await engine.actions('.HAL')
    // Debug.enable('iplog Interpulse')
    const stream = engine.subscribe('.HAL')
    print(stream)
    const response = await actions.user('ping me HAL', 'key-1')
    const state = (await engine.latest('.HAL')).getState().toJS()

    // give a prompt to HAL, see it change directory.
    const prompt = 'change directory to the crm'

    const add = 'add a new customer'
    const nearly = 'addj bob' // if nearly a command, gpt should recognize
  }, 30000)
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
