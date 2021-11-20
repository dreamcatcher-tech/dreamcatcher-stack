import assert from 'assert-fast'
import { modelInflator, precompileSchema } from './modelInflator'
import { registry } from './registry'
import * as crypto from '../../w012-crypto'
import equal from 'fast-deep-equal'
import flatstr from 'flatstr'
import fastJson from 'fast-json-stringify'
import jsonpack from 'jsonpack'
import Debug from 'debug'
const debug = Debug('interblock:models:utils')

const standardize = (model) => {
  checkStructure(model)
  precompileSchema(model.schema)
  const create = model.create
  let defaultInstance
  const { title } = model.schema
  assert(title)
  const id = Symbol(title)
  const isModel = (test) => test && test.getSymbol && test.getSymbol() === id
  const getSymbol = () => id
  const clone = (object) => {
    if (!object) {
      if (!defaultInstance) {
        defaultInstance = standardModel.create()
      }
      return defaultInstance
    }
    if (isModel(object)) {
      return object
    }
    if (typeof object === 'string') {
      object = JSON.parse(object)
    }
    const inflated = modelInflator(model.schema, object)

    const modelFunctions = model.logicize(inflated)

    const { serialize, getHash, equals, getSize } = closure(
      model.schema,
      inflated,
      isModel
    )
    const functions = {
      ...modelFunctions,
      serialize,
      getHash,
      equals,
      getSize,
      getSymbol,
    }
    defineFunctions(inflated, functions)
    deepFreeze(inflated)

    return inflated
  }

  // TODO add produce function so clone isn't overloaded
  const standardModel = Object.freeze({
    ...model,
    create,
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
  const getSize = () => {
    assert(string, 'must call serialize() before size()')
    return string.length
  }
  let string
  const serialize = () => {
    /**
     * Tested on serializing a network object with 20,000 channels.
     * JSON.stringify takes 23ms
     * jsonpack takes 14s but takes 5MB down to 2MB
     * fastJsonStringify takes 200ms
     * snappy compression in nodejs takes it down to 1MB in 9ms
     * snappyjs compression takes it down to 1MB is 72ms
     * zipson down to 1.3MB in 134ms
     */
    // TODO strangely is 10x faster to use JSON.stringify() :shrug:
    // if (!stringify) {
    //   stringify = fastJson(schema)
    // }
    // const string = stringify(inflated)
    // flatstr(string)
    // return string
    // const string = jsonpack.pack(inflated)
    // return string
    string = JSON.stringify(inflated)
    return string
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
  return { equals, serialize, getHash, getSize }
}

const generateHash = (schema, instance) => {
  switch (schema.title) {
    case 'Integrity': {
      return { hash: instance.hash }
    }
    case 'Interblock':
    case 'Block': {
      return {
        // TODO check if hash is calculated correctly
        hash: instance.provenance.reflectIntegrity().hash,
      }
    }
    case 'State': {
      return { hash: crypto.objectHash(instance) }
    }
    default: {
      return hashFromSchema(schema, instance)
    }
  }
}

const hashFromSchema = (schema, instance) => {
  if (schema.patternProperties) {
    const { hash } = hashPattern(instance) // strip proof
    return { hash }
  }
  const hashes = {}
  const { properties } = schema
  Object.keys(instance).forEach((key) => {
    const { title, type, patternProperties, items } = properties[key]
    const slice = instance[key]
    if (registry.isRegistered(title)) {
      hashes[key] = slice.getHash()
      return
    }
    if (type === 'array') {
      hashes[key] = hashArray(slice, items)
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

const hashArray = (instance, items) => {
  if (registry.isRegistered(items.title)) {
    const arrayOfHashes = instance.map((item) => {
      return item.getHash()
    })
    return crypto.objectHash(arrayOfHashes)
  }
  return crypto.objectHash(instance)
}

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

export { standardize }
