const assert = require('assert')
const debug = require('debug')('interblock:models:utils')
const _ = require('lodash')
const stringify = require('fast-json-stable-stringify')
const { produce, setAutoFreeze } = require('immer')
setAutoFreeze(false) // attempt to speed up producers
const { modelInflator } = require('./modelInflator')
const { registry } = require('./registry')
const crypto = require('../../w012-crypto')

const standardize = (model) => {
  checkStructure(model)
  let defaultInstance
  const mapObjectToModel = new Map()
  const mapHashToModel = new Map()
  const cloneSet = new WeakSet()
  let dupeCount = 0
  const clone = (instance, reducer) => {
    if (!instance) {
      if (!defaultInstance) {
        defaultInstance = standardModel.create()
        // TODO WARNING some models are async creators
      }
      return defaultInstance
    }
    if (isModel(instance) && !reducer) {
      return instance
    }
    if (instance && typeof reducer === 'function') {
      assert(isModel(instance), `instance must be ${model.schema.title}`)
      instance = produce(instance, reducer)
    }
    if (mapObjectToModel.has(instance)) {
      return mapObjectToModel.get(instance)
    }
    if (typeof instance === 'string') {
      instance = JSON.parse(instance)
    }
    const inflated = modelInflator(model.schema, instance)

    const { hash, proof } = generateHash(model.schema, inflated)
    if (mapHashToModel.has(hash)) {
      // TODO move to read lookups to detect duplicates
      dupeCount++
      // debug(`dupe hit #: ${dupeCount} for: ${model.schema.title}`)
      if (dupeCount > 99) {
        // debug(`hundy`)
      }
      const hashEquivalent = mapHashToModel.get(hash)
      mapObjectToModel.set(instance, hashEquivalent)
      return hashEquivalent
    }

    const modelFunctions = model.logicize(inflated)
    let jsonString
    const serialize = () => {
      // TODO serialize quicker using schemas with https://www.npmjs.com/package/fast-json-stringify
      // TODO model away serialize
      if (!jsonString) {
        jsonString = stringify(completeModel)
        if (mapObjectToModel.has(jsonString)) {
          assert.equal(mapObjectToModel.get(jsonString), completeModel)
        } else {
          mapObjectToModel.set(jsonString, completeModel)
          assert.equal(jsonString, completeModel.serialize())
        }
      }
      return jsonString
    }
    const equals = (other) => {
      if (!isModel(other)) {
        return false
      }
      return _.isEqual(completeModel, other)
    }
    const getHash = () => hash
    const getProof = () => {
      if (!proof) {
        throw new Error(`no proof defined ${model.schema.title}`)
      }
      return proof
    }
    const functions = {
      ...modelFunctions,
      serialize,
      equals,
      getHash,
      getProof,
    }
    const completeModel = proxy(inflated, functions)
    cloneSet.add(completeModel)
    mapHashToModel.set(hash, completeModel)
    mapObjectToModel.set(instance, completeModel)
    return completeModel
  }

  // TODO add produce function so clone isn't overloaded
  const isModel = (test) => cloneSet.has(test)
  const standardModel = Object.freeze({ ...model, clone, isModel })
  return standardModel
}

const generateHash = (schema, instance) => {
  switch (schema.title) {
    case 'Integrity': {
      return { hash: instance.hash }
    }
    case 'Block': {
      const interblockKeys = ['provenance', 'network', 'validators']
      const restOfBlock = _.omit(instance, interblockKeys)
      const proof = crypto.objectHash(hashPattern(restOfBlock))
      return { hash: instance.provenance.getHash(), proof }
    }
    case 'Network': {
      const { hash, proof: networkChannels } = hashPattern(instance)
      return { hash, proof: { networkChannels } } // returns proof
    }
    case 'Channel': {
      const remoteModel = registry.get('Remote')
      const remote = remoteModel.clone(
        _.pick(instance, [
          'address',
          'requests',
          'replies',
          'heavyHeight',
          'lineageHeight',
        ])
      )
      const restOfChannel = _.omit(instance, Object.keys(remote))
      const properties = _.omit(
        schema.properties,
        remoteModel.schema.properties
      )
      const { hash: proof } = hashFromSchema({ properties }, restOfChannel)
      const hash = crypto.objectHash({ remote: remote.getHash(), proof })
      return { hash, proof }
    }
    case 'State': {
      return { hash: crypto.objectHash(instance) }
    }
    // TODO lock, rx* do not need true hashing - can speed up by using stringify for them ?
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
  const handler = {
    get(target, prop, receiver) {
      if (functions[prop]) {
        return functions[prop]
      }
      // return Reflect.get(...arguments)
      return target[prop]
    },
    set(target, prop, value, receiver) {
      throw new Error(`Model properties cannot be altered: ${prop}`)
    },
    deleteProperty(target, prop) {
      throw new Error(`Model properties cannot be deleted: ${prop}`)
    },
  }
  const proxy = new Proxy(target, handler)
  return proxy
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

module.exports = { standardize }
