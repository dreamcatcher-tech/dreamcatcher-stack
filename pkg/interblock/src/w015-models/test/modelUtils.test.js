import { assert } from 'chai/index.mjs'
import madge from 'madge'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  channelModel,
  networkModel,
  integrityModel,
  covenantIdModel,
  addressModel,
  pendingModel,
  rxReplyModel,
  actionModel,
  rxRequestModel,
} from '..'

describe('standard model', () => {
  test('isModel', () => {
    assert(!covenantIdModel.isModel())
    assert(!covenantIdModel.isModel('not a model'))
    assert(!covenantIdModel.isModel({ still: 'not a model' }))

    const is = covenantIdModel.create()
    assert(covenantIdModel.isModel(is))
    const json = is.serialize()
    assert(!covenantIdModel.isModel(json))
    const reinflate = JSON.parse(json)
    assert(!covenantIdModel.isModel(reinflate))
    const clone = covenantIdModel.clone(reinflate)
    assert(covenantIdModel.isModel(clone))
  })
  test('equals works after serialize', () => {
    const integrity = integrityModel.create({ test: 'test' })
    const json = integrity.serialize()
    assert.strictEqual(typeof json, 'string')
    const reflated = integrityModel.clone(json)
    const clone = integrityModel.clone(reflated)
    assert(clone.equals(integrity))
    assert(reflated.equals(integrity))
  })
  test('equals works after serialize for nested types', () => {
    const id = covenantIdModel.create('test')
    const json = id.serialize()
    assert.strictEqual(typeof json, 'string')
    const reflated = covenantIdModel.clone(json)
    const clone = covenantIdModel.clone(reflated)
    assert(clone.equals(id))
    assert(reflated.equals(id))
  })
  test('equals works after serialize for nested pattern types', () => {
    const address = addressModel.create()
    const integrity = address.chainId

    const raw = JSON.parse(address.serialize())

    const clone = addressModel.clone(raw)
    assert(!clone.equals(raw))
    assert(clone.equals(address))
    assert(clone.chainId.equals(integrity), 'integrity not reinflated')
  })
  test('serialize is independent', () => {
    const i1 = integrityModel.create('i1')
    const i2 = integrityModel.create('i2')
    assert(!i1.equals(i2))
    const s1 = i1.serialize()
    const s2 = i2.serialize()
    assert.notStrictEqual(s1, s2)
    assert.strictEqual(s1, JSON.stringify(i1))
  })
  test('objects are immutable', () => {
    const integrity = integrityModel.create({ test: 'test' })
    assert(integrity.hash)
    assert.throws(() => delete integrity.hash)
    assert(integrity.hash)
  })
  test('functions are immutable', () => {
    const integrity = integrityModel.create({ test: 'test' })
    assert(integrity.isUnknown)
    assert.throws(() => delete integrity.isUnknown)
    assert(integrity.isUnknown)
  })
  test('nested objects are inflated from clones', () => {
    const covenantId = covenantIdModel.create()
    const deflated = JSON.parse(JSON.stringify(covenantId))
    const altered = { ...deflated, name: 'altered' }
    const clone = covenantIdModel.clone(deflated)
    assert(clone.integrity.isUnknown())
    const cloneAltered = covenantIdModel.clone(altered)
    assert(
      cloneAltered.integrity.isUnknown,
      'reinflation failed on child functions'
    )
    assert(
      cloneAltered.integrity.isUnknown(),
      'reinflation failed on child functions'
    )
  })
  test('pattern at top level', () => {
    const tx = channelModel.create()
    let network = networkModel.create()
    network = networkModel.clone({
      ...network,
      testPattern: channelModel.create(),
    })
    assert(network.testPattern.equals(tx))
    const clone = networkModel.clone(network.serialize())
    assert(clone.testPattern.equals(tx))
  })
  test('objects have no functions attached as enumerable properties', () => {
    const transmission = channelModel.create()
    assert(transmission.isTransmitting)
    for (const key in transmission) {
      if (key === 'isTransmitting') {
        assert.fail()
      }
    }
  })
  test('pattern objects are inflated', () => {
    // TODO move to channelModel test, as need a nested pattern property
    const tx = channelModel.create()
    let network = networkModel.create()
    network = networkModel.clone({
      ...network,
      testPattern: channelModel.create(),
    })
    assert(network.testPattern.equals(tx))
    const clone = networkModel.clone(network.serialize())
    assert(clone.testPattern.equals(tx))
  })
  test('array items are inflated', () => {
    const address = addressModel.create('TEST')
    const pendingRequest = rxRequestModel.create('TEST', {}, address, 0, 0)
    const reply = rxReplyModel.create(undefined, undefined, address, 0, 0)
    const pending = pendingModel.clone({
      pendingRequest,
      bufferedReplies: [reply],
    })
    assert(Array.isArray(pending.bufferedReplies))
    assert.strictEqual(pending.bufferedReplies.length, 1)

    const json = pending.serialize()
    assert.strictEqual(typeof json, 'string')
    const revived = pendingModel.clone(json)
    assert(revived.equals(pending))
    assert.strictEqual(revived.bufferedReplies.length, 1)
    assert(revived.bufferedReplies.every(rxReplyModel.isModel))
  })
  test.todo('array items inside pattern properties are inflated')
  test.todo('isModel only returns true if the object is in the clone cache')
  test.todo('allows option elements, specifically validators in interblock')
  test('reject on schema fail', () => {
    assert.throws(() => covenantIdModel.clone({ type: 'NOTHING' }))
  })
  test('can make a model from an existing model', () => {
    const model = covenantIdModel.create()
    const modelClone = covenantIdModel.clone(model)
    assert(covenantIdModel.isModel(modelClone))
  })
  test.skip('no circular references in models', async () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const res = await madge(__dirname + '/../src/models', {
      excludeRegExp: [/\.\./],
    })
    const path = await res.image(
      __dirname + '/../../../website/static/img/models.svg'
    )
    console.log(`wrote image to: ${path}`)
  })
  test('models all found', () => {})
  test.todo('check the version of the message format')
  test.todo('can always create default with no arguments')
  test.todo('clone handles dmz.state with loops')
  test.todo('optional properties which are missing are not inflated')
})
