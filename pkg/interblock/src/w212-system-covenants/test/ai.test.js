import { Interpulse } from '../..'
import dotenv from 'dotenv'
import { injectResponses } from '../src/ai'
import Debug from 'debug'
const debug = Debug('test')
dotenv.config({ path: '../../.env' })

describe('ai', () => {
  it('makes an api call to openai', async () => {
    injectResponses('bob your uncle')
    const engine = await Interpulse.createCI()
    await engine.add('ai', { covenant: 'ai' })
    const actions = await engine.actions('ai')
    debug('ai actions', actions)

    const result = await actions.prompt('repeat this: "bob your uncle"', 'key')

    debug('result', result)
  })
  it.todo('streams back results')
  it('runs a shell command', async () => {
    const engine = await Interpulse.createCI()
    // Debug.enable('iplog *:ai')
    await engine.bootHal()
    const actions = await engine.actions('.HAL')
    console.log(actions)
    const response = await actions.prompt('meow', 'key')
    console.log(response)
    // .ai is a thread management system

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
