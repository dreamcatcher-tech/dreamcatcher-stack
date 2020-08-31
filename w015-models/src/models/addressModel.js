const assert = require('assert')
const crypto = require('../../../w012-crypto')
const { standardize } = require('../utils')
const { integrityModel } = require('./integrityModel')
const { addressSchema } = require('../schemas/modelSchemas')

const addressModel = standardize({
  schema: addressSchema,
  create: (integrity = integrityModel.create()) => {
    let status = `UNKNOWN`
    if (integrity === `GENESIS`) {
      // the source of randomness in genesis block creation
      status = `GENESIS_${crypto.generateNonce()}`
      integrity = integrityModel.create('UNKNOWN')
    } else if (integrity === 'LOOPBACK') {
      status = 'LOOPBACK'
      integrity = integrityModel.create('UNKNOWN')
    } else if (integrity === 'ROOT') {
      status = 'ROOT'
      integrity = integrityModel.create('UNKNOWN')
    } else if (typeof integrity === 'string') {
      const possibleIntegrity = integrityModel.create(integrity)
      if (possibleIntegrity.hash.length === integrity.length) {
        // TODO use a regex tester
        const hash = integrity
        integrity = integrityModel.clone({
          ...possibleIntegrity,
          hash,
        })
      } else {
        integrity = possibleIntegrity
      }
    }
    if (!integrityModel.isModel(integrity)) {
      debug(`integrity not model: `, integrity)
    }
    assert(integrityModel.isModel(integrity))
    if (!integrity.isUnknown()) {
      status = `RESOLVED`
    }
    return addressModel.clone({ chainId: integrity, status })
  },
  logicize: (instance) => {
    const { chainId, status } = instance
    const getChainId = () => {
      if (status === 'LOOPBACK') {
        return 'LOOPBACK'
      }
      if (status === 'ROOT') {
        return 'ROOT'
      }
      if (status !== 'RESOLVED') {
        throw new Error(
          `Tried to get chainId on address with status: ${status}`
        )
      }
      return chainId.hash
    }
    const isRoot = () => status === 'ROOT'
    const isLoopback = () => status === 'LOOPBACK'
    const isGenesis = () => status.startsWith('GENESIS_')
    const isUnknown = () => status === 'UNKNOWN'
    const isResolved = () => status === 'RESOLVED'
    return {
      getChainId,
      isRoot,
      isLoopback,
      isGenesis,
      isUnknown,
      isResolved,
    }
  },
})

module.exports = { addressModel }
