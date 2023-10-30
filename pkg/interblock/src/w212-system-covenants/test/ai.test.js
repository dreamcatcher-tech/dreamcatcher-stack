import { Interpulse } from '../..'
import Debug from 'debug'
const debug = Debug('test')

describe('ai', () => {
  it('makes an api call to openai', async () => {
    // load up a base covenant
    // make a ping request to openai
    // verify result

    Debug.enable('test *ai  ')

    const engine = await Interpulse.createCI()
    await engine.add('ai', { covenant: 'ai' })
    const actions = await engine.actions('ai')
    debug('ai actions', actions)

    const result = await actions.prompt('repeat this: "bob your uncle"', [])
    // hook the context and get the stream result back too

    debug('result', result)

    const col = await engine.latest('col1')
    const colState = col.getState().toJS()
    debug(colState)
    assert(!colState.template.formData)
    assert(!colState.template.network.address.formData)
    debug('adding item to collection')

    await actions.add(customerData)
    const nextColState = await engine.latest('col1')
    assert.deepEqual(nextColState.getState(), col.getState())
    const customer = await engine.latest('col1/file_00001')
    assert(customer.getState().toJS().formData.firstName)
    // all covenants to respond to install events, and ignore or respond differently
    assert(!customer.getState().toJS().network.address.formData)
    const address = await engine.latest('col1/file_00001/address')
    assert(address.getState().formData.address)

    debug('adding second item to collection')
    engine.metro.enableLogging()
    await actions.add(customerData)
    const customer2 = await engine.latest('col1/file_00002')
  })
})
