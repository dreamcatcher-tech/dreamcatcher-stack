import { Interpulse, useAsync } from '../..'
import dotenv from 'dotenv'
import { injectResponses } from '../src/ai'
import Debug from 'debug'
const debug = Debug('test')
dotenv.config({ path: '../../.env' })

describe('threads', () => {
  it('runs a shell command', async () => {
    // start a thread, which targets /
    const engine = await Interpulse.createCI()
    await engine.bootHal()

    const actions = await engine.actions('.HAL')
    const response = await actions.user('ping me HAL', 'key-1')
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
  }, 30000)
})
