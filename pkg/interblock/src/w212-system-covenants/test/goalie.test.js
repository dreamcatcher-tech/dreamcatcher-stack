import { Interpulse } from '../..'
import dotenv from 'dotenv'
import { rmReasons } from '../src/goalie'
import Debug from 'debug'
const debug = Debug('tests')
dotenv.config({ path: '../../.env' })

describe('goalie', () => {
  it('artifact interation', async () => {
    const engine = await Interpulse.createCI()
    await engine.add('testGoalie', 'goalie')
    const actions = await engine.actions('testGoalie')
    debug('testGoalie actions', actions)
    // test out the add ls update close prioritize functions
    const { order: id0 } = await actions.add({
      titles: ['test0'],
      summary: 'test0',
    })
    expect(id0).toEqual([0])
    const state0 = await engine.cat('testGoalie/0')
    expect(state0).toEqual({ summary: 'test0', titles: ['test0'] })

    const { order: id1 } = await actions.add({
      titles: ['test1'],
      summary: 'test1',
    })
    expect(id1).toEqual([1, 0])
    const state1 = await engine.cat('testGoalie/1')
    expect(state1).toEqual({ summary: 'test1', titles: ['test1'] })

    const state = await engine.cat('testGoalie')
    debug('state', state)
    expect(state.order).toEqual([1, 0])

    const { order } = await actions.prioritize([0])
    debug('order', order)
    expect(order).toEqual([0, 1])

    const { order: rm } = await actions.rm(1, rmReasons.IRRELEVANT)
    debug('rm', rm)

    const update = await actions.update(0, ['test2'], 'test2')
    expect(update).toEqual({ summary: 'test2', titles: ['test2'] })
  })
  it('determines the goals of Dave', async () => {
    const engine = await Interpulse.createCI()
    Debug.enable('iplog *goalie tests')
    await engine.add('testGoalie', 'goalie')
    const actions = await engine.actions('testGoalie')
    debug('testGoalie actions', actions)
  }, 20000)

  it.todo('streams back results')
})
