import chai, { assert } from 'chai/index.mjs'
import { Keypair } from '../../src/ipld/Keypair'
import chaiAsPromised from 'chai-as-promised'
chai.use(chaiAsPromised)
import crypto from 'libp2p-crypto'
import Debug from 'debug'
const debug = Debug('interblock:tests:Keypair')

describe('keypair', () => {
  test('basic', async () => {
    const keypairDefault1 = Keypair.createCI()
    const keypairDefault2 = Keypair.createCI()
    const keypair1 = Keypair.createCI('KP1')
    const keypair2 = Keypair.createCI('KP2')
    assert(keypair1 instanceof Keypair)

    assert.strictEqual(keypairDefault1.name, 'CI')
    assert.deepEqual(keypairDefault1, keypairDefault2)
    assert.notDeepEqual(keypair1, keypair2)
    assert.notDeepEqual(keypairDefault1, keypair1)

    assert.throws(() => (keypair1.name = 'tamper'), 'Cannot assign')
  })
  test('generation', async () => {
    const kp1 = await Keypair.generate('TEST')
    const kp2 = await Keypair.generate('TEST')
    assert.notDeepEqual(kp1, kp2)
    const v1 = kp1.getValidatorEntry()
    const v2 = kp2.getValidatorEntry()
    const { key: v1pk, ...v1Rest } = kp1.publicKey
    const { key: v2pk, ...v2Rest } = kp2.publicKey

    assert.notDeepEqual(v1, v2)
    assert.notDeepEqual(v1pk, v2pk)
    assert.deepEqual(v1Rest, v2Rest)
  })
})