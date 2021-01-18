const assert = require('assert')
const debug = require('debug')('interblock:models:utils')
const isCircular = require('is-circular')
const _ = require('lodash')
const stringify = require('fast-json-stable-stringify')
const { produce, setAutoFreeze } = require('immer')
setAutoFreeze(false) // we already freeze everything anyway
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
  const clone = (object, reducer) => {
    if (!object) {
      if (!defaultInstance) {
        defaultInstance = standardModel.create()
        // TODO WARNING some models are async creators
      }
      return defaultInstance
    }
    if (isModel(object) && !reducer) {
      return object
    }
    if (object && typeof reducer === 'function') {
      assert(isModel(object), `instance must be ${model.schema.title}`)
      object = produce(object, reducer)
    }
    if (typeof object === 'string') {
      object = JSON.parse(object)
    }
    if (objectToModelWeakMap.has(object)) {
      return objectToModelWeakMap.get(object)
    }
    const inflated = modelInflator(model.schema, object)

    // deepFreeze(inflated)
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
    const completeInstance = proxy(inflated, functions)
    modelWeakSet.add(completeInstance)
    objectToModelWeakMap.set(object, completeInstance)
    return completeInstance
  }

  // TODO add produce function so clone isn't overloaded
  const standardModel = Object.freeze({ ...model, create, clone, isModel })
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
      // assert(!isCircular(inflated), `state must be stringifiable`)
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
    case 'Integrity': {
      return { hash: instance.hash }
    }
    case 'Block': {
      // TODO do not generate proof unless explicitly asked for it
      const nonInterblockKeys = [
        'encryption',
        'timestamp',
        'config',
        'covenantId',
        'binaryIntegrity',
        'acl',
        'state',
        'pending',
      ]
      const restOfBlock = _pick(instance, nonInterblockKeys)
      const proof = crypto.objectHash(hashPattern(restOfBlock))
      return { hash: instance.provenance.getHash(), proof }
    }
    case 'Network': {
      const { hash, proof: networkChannels } = hashPattern(instance)
      return { hash, proof: { networkChannels } } // returns proof
    }
    case 'Channel': {
      const remoteModel = registry.get('Remote')
      const remotePick = _pick(instance, [
        'address',
        'replies',
        'requests',
        'heavyHeight',
        'lineageHeight',
      ])
      const remote = remoteModel.clone(remotePick)
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
    hashes[key] = crypto.objectHash(slice)
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

const proxy = (target, functions) => {
  // TODO check no collisions between function names and target
  for (const prop in target) {
    assert(!functions[prop], `function collision: ${prop}`)
  }

  for (const functionName in functions) {
    Object.defineProperty(target, functionName, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: functions[functionName]
    });
  }

  deepFreeze(target)

  // const handler = {
  //   get(target, prop, receiver) {
  //     if (functions[prop]) {
  //       return functions[prop]
  //     }
  //     return target[prop]
  //   },
  //   set(target, prop, value, receiver) {
  //     throw new Error(`Model properties cannot be altered: ${prop}`)
  //   },
  //   deleteProperty(target, prop) {
  //     throw new Error(`Model properties cannot be deleted: ${prop}`)
  //   },
  // }
  // const proxy = new Proxy(target, handler)
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
  // TODO memoize but keep unique requests, like to Action
  // if (model.schema.title === 'Action') {
  return model.create
  // }
  // return _.memoize(model.create)
}
const deepFreeze = (o) => {
  Object.freeze(o)
  for (const prop in o) {
    if (o[prop] === undefined) {
      // undefined values have their keys removed in json
      throw new Error(`Values cannot be undefined: ${prop}`)
    }
    if (typeof o[prop] === 'function') {
      throw new Error(`No functions in deepFreeze: ${prop}`)
    }
    if (typeof o[prop] === 'object' && !Object.isFrozen(o[prop])) {
      deepFreeze(o[prop])
    }
  }
}

module.exports = { standardize }
