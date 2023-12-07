import { Interpulse } from '../..'
import dotenv from 'dotenv'
import Debug from 'debug'
const debug = Debug('tests')
dotenv.config({ path: '../../.env' })

describe('HAL', () => {
  it.only('prompt marshalling', async () => {
    const engine = await Interpulse.createCI()
    // Debug.enable('iplog *hal tests *threads *openPath ')
    await engine.bootHal()
    // HAL is the executing AI
    const actions = await engine.actions('.HAL')
    debug('HAL actions', actions)
    Debug.enable('iplog')
    const result = await actions.prompt('I want to add a customer')
    console.dir(result, { depth: Infinity })
    // debug('goalie result', result)
  }, 60000)
})
