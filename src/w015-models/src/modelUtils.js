const assert = require('assert')
const debug = require('debug')('interblock:models:utils')
const memoize = require('lodash.memoize')
const stringify = require('fast-json-stable-stringify')
const { modelInflator, precompileSchema } = require('./modelInflator')
const { registry } = require('./registry')
const crypto = require('../../w012-crypto')
const equal = require('fast-deep-equal')

const standardize = (model) => {
  checkStructure(model)
  precompileSchema(model.schema)
  const create = memoizeCreate(model)
  let defaultInstance
  const modelWeakSet = new WeakSet()
  const objectToModelWeakMap = new WeakMap()
  const isModel = (test) => modelWeakSet.has(test)
  const merge = (model, merge) => {
    assert(isModel(model))
    assert.strictEqual(typeof merge, 'object')
    if (!Object.keys(merge).length) {
      return model
    } else {
      return clone({ ...model, ...merge })
    }
  }
  const clone = (object) => {
    if (!object) {
      if (!defaultInstance) {
        defaultInstance = standardModel.create()
        // TODO WARNING some models are async creators
      }
      return defaultInstance
    }
    if (isModel(object)) {
      return object
    }
    if (typeof object === 'string') {
      object = JSON.parse(object)
    }
    if (objectToModelWeakMap.has(object)) {
      return objectToModelWeakMap.get(object)
    }
    const inflated = modelInflator(model.schema, object)

    const modelFunctions = model.logicize(inflated)

    const { serialize, getHash, getProof, equals } = closure(
      model.schema,
      inflated,
      isModel
    )
    const functions = {
      ...modelFunctions,
      serialize,
      getHash,
      getProof,
      equals,
    }
    const frozenInstance = defineFunctions(inflated, functions)
    modelWeakSet.add(frozenInstance)
    objectToModelWeakMap.set(object, frozenInstance)
    return frozenInstance
  }

  // TODO add produce function so clone isn't overloaded
  const standardModel = Object.freeze({
    ...model,
    create,
    merge,
    clone,
    isModel,
  })
  return standardModel
}

const closure = (schema, inflated, isModel) => {
  const equals = (other) => {
    if (!isModel(other)) {
      return false
    }
    return equal(inflated, other)
  }
  let jsonString
  const serialize = () => {
    // TODO serialize quicker using schemas with https://www.npmjs.com/package/fast-json-stringify
    // TODO model away serialize
    if (!jsonString) {
      // TODO ensure this check is sufficient for stringify
      jsonString = stringify(inflated)
    }
    return jsonString
  }
  let cachedHash, cachedProof
  const _generateHashWithProof = () => {
    assert.strictEqual(typeof inflated, 'object')
    const { hash, proof } = generateHash(schema, inflated)
    cachedHash = hash
    cachedProof = proof
  }
  const getHash = () => {
    if (!cachedHash) {
      _generateHashWithProof()
      assert(cachedHash)
    }
    return cachedHash
  }
  const getProof = () => {
    if (!cachedProof) {
      _generateHashWithProof()
      assert(cachedProof)
    }
    return cachedProof
  }
  return { equals, serialize, getHash, getProof }
}

const generateHash = (schema, instance) => {
  switch (schema.title) {
    case 'Action': {
      if (instance.type === '@@GENESIS' && instance.payload.genesis) {
        const { genesis } = instance.payload
        const blockModel = registry.get('Block')
        assert(blockModel.isModel(genesis))
        const modified = { ...instance, payload: { ...instance.payload } }
        modified.payload.genesis = genesis.getHash()
        return hashFromSchema(schema, modified)
      }
      return hashFromSchema(schema, instance)
    }
    case 'Integrity': {
      return { hash: instance.hash }
    }
    case 'Interblock':
    case 'Block': {
      return {
        // TODO check if hash is calculated correctly
        hash: instance.provenance.reflectIntegrity().hash,
        proof: 'no proof needed',
      }
    }
    case 'Network': {
      const { hash, proof: networkChannels } = hashPattern(instance)
      return { hash, proof: { networkChannels } }
    }
    case 'Channel': {
      const remote = _pickRemote(instance)
      const restOfChannelKeys = [
        'systemRole',
        'requestsLength',
        'heavy',
        'lineage',
        'lineageTip',
      ]
      const restOfChannel = _pick(instance, restOfChannelKeys)
      const properties = _pick(schema.properties, restOfChannelKeys)
      const { hash: proof } = hashFromSchema({ properties }, restOfChannel)
      const hash = crypto.objectHash({ remote: remote.getHash(), proof })
      return { hash, proof }
    }
    case 'State': {
      return { hash: crypto.objectHash(instance) }
    }
    case 'SimpleArray': {
      // TODO remove this when can handle pattern properties correctly
      return { hash: crypto.objectHash(instance) }
    }
    // TODO lock, rx* do not need true hashing - can speed up by using stringify for them ?
    default: {
      return hashFromSchema(schema, instance)
    }
  }
}
const _pickRemoteRaw = (instance) => {
  const remoteModel = registry.get('Remote')
  const remotePick = _pick(instance, [
    'address',
    'replies',
    'requests',
    'heavyHeight',
    'lineageHeight',
  ])
  const remote = remoteModel.clone(remotePick)
  return remote
}
const _pickRemote = memoize(_pickRemoteRaw)
const _pick = (obj, keys) => {
  // much faster than lodash pick
  const blank = {}
  keys.forEach((key) => {
    if (typeof obj[key] !== 'undefined') {
      blank[key] = obj[key]
    }
  })
  return blank
}

const hashFromSchema = (schema, instance) => {
  if (schema.patternProperties) {
    const { hash } = hashPattern(instance) // strip proof
    return { hash }
  }
  const hashes = {}
  const { properties } = schema
  Object.keys(instance).map((key) => {
    const { title, type, patternProperties } = properties[key]
    const slice = instance[key]
    if (registry.isRegistered(title)) {
      hashes[key] = slice.getHash()
      return
    }
    if (type === 'array') {
      hashes[key] = hashArray(slice)
      return
    }
    if (patternProperties) {
      const { hash } = hashPattern(slice)
      hashes[key] = hash
      return
    }
    hashes[key] = slice
  })
  return { hash: crypto.objectHash(hashes) }
}

const hashArray = (instance) =>
  crypto.objectHash(instance.map((item) => item.getHash()))

const hashPattern = (instance) => {
  const proof = Object.keys(instance).map((key) =>
    crypto.objectHash({ [key]: instance[key].getHash() })
  )
  proof.sort()
  const hash = crypto.objectHash(proof)
  return { hash, proof }
}

const defineFunctions = (target, functions) => {
  for (const prop in target) {
    assert(!functions[prop], `function collision: ${prop}`)
  }
  const properties = {}
  for (const functionName in functions) {
    properties[functionName] = {
      enumerable: false,
      configurable: false,
      writable: false,
      value: functions[functionName],
    }
  }
  Object.defineProperties(target, properties)
  deepFreeze(target)
  return target
}

const checkStructure = (model) => {
  const { title } = model.schema
  const functionCheck = ['create', 'logicize']
  functionCheck.forEach((key) => {
    if (typeof model[key] !== 'function') {
      throw new Error(`Model: ${title} needs function: ${key}`)
    }
  })
  const propertiesCount = Object.keys(model).length
  if (propertiesCount !== 3) {
    throw new Error(`Model: ${title} has ${propertiesCount} properties, not 3`)
  }
}
const memoizeCreate = (model) => {
  const memoized = memoize(model.create)
  return (...args) => {
    if (!args.length) {
      return memoized(...args)
    }
    return model.create(...args)
  }
}
const deepFreeze = (o) => {
  Object.freeze(o)
  for (const prop in o) {
    if (o[prop] === undefined) {
      // undefined values have their keys removed in json
      throw new Error(`Values cannot be undefined: ${prop}`)
    }
    if (typeof o[prop] === 'function') {
      throw new Error(`No functions allowed in deepFreeze: ${prop}`)
    }
    if (typeof o[prop] === 'object' && !Object.isFrozen(o[prop])) {
      deepFreeze(o[prop])
    }
  }
}

module.exports = { standardize }
