import { deleteAsync } from 'del'
import { createRepo } from 'ipfs-repo'
import { createBackend } from '../src/createBackend'
import { loadCodec } from '../src/loadCodec'
import { Keypair } from '../../w008-ipld'
import { PulseNet } from '..'
import Debug from 'debug'
const debug = Debug('interpulse:tests:ramrepo')

describe('store', () => {
  test('ram', async () => {
    const net = await PulseNet.createCI()
    await expect(net.repo.isInitialized()).resolves.toBeTruthy()
    const keypair = net.keypair
    expect(keypair).toBeInstanceOf(Keypair)
    expect(net.keypair).toEqual(Keypair.createCI())
    await net.stop()
  })
  test('repo is closed after net.stop()', async () => {
    const repo = createRepo('ciRepo', loadCodec, createBackend())
    expect(repo.closed).toBeTruthy()
    const net = await PulseNet.createCI(repo)
    expect(repo.closed).toBeFalsy()
    await net.stop()
    expect(repo.closed).toBeTruthy()
  })
  test('ram reload', async () => {
    const repo = createRepo('ciRepo', loadCodec, createBackend())
    const net = await PulseNet.create(repo)
    const { keypair } = net
    await net.stop()

    const reload = await PulseNet.create(repo)
    expect(reload.keypair).toEqual(keypair)
    expect(reload.keypair).not.toEqual(Keypair.createCI())
    const netId = net.libp2p.peerId.toString()
    const reloadId = reload.libp2p.peerId.toString()
    expect(reloadId).toEqual(netId)
    await reload.stop()
  })
  test('disk', async () => {
    const path = `tmp/repo-${Math.random()}`
    let keypair
    try {
      const net = await PulseNet.create(path)
      keypair = net.keypair
      await net.stop()

      const reload = await PulseNet.create(path)
      expect(reload.keypair).toEqual(keypair)
      await reload.stop()
    } finally {
      debug(`deleting ${path}`)
      await deleteAsync(path)
      debug(`deleted ${path}`)
    }
  })
  test.todo('latest is recovered from storage on reload')
})
