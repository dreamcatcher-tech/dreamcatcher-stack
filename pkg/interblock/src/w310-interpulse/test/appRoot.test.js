import { Interpulse } from '..'
import Debug from 'debug'
import assert from 'assert-fast'
import { Endurance } from '../../w210-engine'
const debug = Debug('tests')
describe('appRoot', () => {
  test('nested child updates parent', async () => {
    const engine = await Interpulse.createCI()
    await engine.add('child1')
    await engine.add('child1/nested1')
    await engine.ping('child1/nested1')

    const latest = await engine.latest()
    const rootChannel = await latest.getNetwork().getChannel('child1/nested1')
    assert(!rootChannel.rx.latest)
    const child1 = await engine.latest('child1')
    const child1Channel = await child1.getNetwork().getChannel('nested1')
    const rootTip = rootChannel.rx.tip
    const child1Tip = child1Channel.rx.latest
    assert(rootTip.equals(child1Tip))
  })
  test('nested child parent is looked up from pulses', async () => {
    const endurance = Endurance.create()
    const engine = await Interpulse.createCI({ endurance })
    await engine.add('child1')
    await engine.add('child1/nested1')
    await engine.ping('child1/nested1')
    endurance._flushLatests()

    await engine.ping('child1/nested1')

    const latest = await engine.latest()
    const rootChannel = await latest.getNetwork().getChannel('child1/nested1')
    assert(!rootChannel.rx.latest)
    const child1 = await engine.latest('child1')
    const child1Channel = await child1.getNetwork().getChannel('nested1')
    const rootTip = rootChannel.rx.tip
    const child1Tip = child1Channel.rx.latest
    assert(rootTip.equals(child1Tip))
    await engine.stop()
  })
})
