import { Interpulse } from '../..'
import dotenv from 'dotenv'
import { rmReasons } from '../src/goalie'
import Debug from 'debug'
const debug = Debug('tests')
dotenv.config({ path: '../../.env' })

describe('goalie', () => {
  it('prompt marshalling', async () => {
    const engine = await Interpulse.createCI()
    Debug.enable('iplog *hal tests *threads *openPath ')
    await engine.bootHal()
    // HAL is the executing AI
    const actions = await engine.actions('.HAL')
    debug('HAL actions', actions)
    // const result = await actions.prompt('hello')
    // debug('goalie result', result)
  }, 600)
})
