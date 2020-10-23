const assert = require('assert')
const debug = require('debug')('interblock:tests:pierce')
const { metrologyFactory } = require('..')
const { request } = require('../../w002-api')

describe('pierce', () => {
  require('debug').enable('*metro* *pierce*')
  test('basic ping', async () => {
    jest.setTimeout(1000)
    const base = await metrologyFactory()
    const ping = request('PING')
    const reply = await base.pierce(ping)
    assert.strictEqual(reply.type, 'PONG')
    const second = await base.pierce(ping)
    assert.strictEqual(second.type, 'PONG')

    debug(`pings complete`)
    await base.settle()
    const remoteIndices = base
      .getState()
      .network['@@io'].getRemoteRequestIndices()
    assert.strictEqual(remoteIndices.length, 1)
    assert.strictEqual(remoteIndices[0], 1)
  })
  test('do not txInterblocks to @@io channel', async () => {
    const base = await metrologyFactory()
    const { ioTransmit, sqsTransmit } = base.getEngine()
    let noIoTransmissions = true
    sqsTransmit.subscribe((interblock) => {
      if (interblock.network && interblock.network['@@io']) {
        noIoTransmissions = false
      }
    })
    await base.pierce(request('PING'))
    assert(noIoTransmissions)
    await base.settle()
  })
  test.todo('reject for unknown chainId')
  test.todo('reject for unpierced chain')
  test.todo('duplicate piercings only included once')
  test.todo('piercings already in current block excluded')
  test.todo('acl blocked system action is rejected')
  test.todo('unpierced chain rejects attempted outbound pierce')
  test.todo('reject attempt to make channel named @@io even if pierced')
  test.todo('unpierce during pierce execution drops all other pierces')
  test.todo('opening pierce channel alone does not cause extra lineage')
  test.todo('always at least one tx in the channel to keep count')
  test.todo('change to unpierced removes @@io channel')
  test.todo('if not in block piercing is not purged from db')
})
