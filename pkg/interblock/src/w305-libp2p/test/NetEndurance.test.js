import { createRamRepo } from '../../w305-libp2p'
import { pushable } from 'it-pushable'
import { NetEndurance, PulseNet } from '..'
import { Interpulse, apps } from '../../index.mjs'
import Debug from 'debug'
const debug = Debug('tests')

describe('NetEndurance', () => {
  test('diffing', async () => {
    const repo = createRamRepo('diffing')
    const engine = await Interpulse.createCI({
      overloads: { '/crm': apps.crm.covenant },
      repo,
    })
    await engine.add('app', '/crm')
    const base = await engine.current('/app')
    await engine.ping('/app')
    const diff = await engine.current('/app')
    expect(diff.cid.equals(base.cid)).toBeFalsy()
    await engine.stop()

    const net = await PulseNet.createCI(repo)
    const endurance = await NetEndurance.create(net)

    const dlink = diff.getPulseLink()
    const blink = base.getPulseLink()

    const fullStream = pushable({ objectMode: true })
    await endurance.streamWalk(fullStream, dlink, undefined, 'deepPulse')
    const diffStream = pushable({ objectMode: true })
    await endurance.streamWalk(diffStream, dlink, blink, 'deepPulse')

    const saved = fullStream.readableLength - diffStream.readableLength
    expect(saved).toBeGreaterThan(0)

    const repeat = pushable({ objectMode: true })
    const cached = await endurance.streamWalk(repeat, dlink, blink, 'deepPulse')
    expect(cached).toBeTruthy()
    await net.stop()
  })
})
