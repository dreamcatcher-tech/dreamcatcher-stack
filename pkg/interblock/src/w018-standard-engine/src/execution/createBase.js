import { blockModel, interblockModel } from '../../../w015-models'

const createBase = async (ioConsistency, sqsPool) => {
  const baseAddressPromise = tapConsistency(ioConsistency)
  triggerIgnition(sqsPool)
  const baseAddress = await baseAddressPromise
  return baseAddress
}
const triggerIgnition = (sqsPool) => {
  const igniter = interblockModel.clone(prebuiltInterblock)
  sqsPool.push(igniter)
}

const tapConsistency = (ioConsistency) => {
  let baseAddressFound
  const promise = new Promise((resolve) => (baseAddressFound = resolve))
  const unsubscribe = ioConsistency.subscribe(async (action, queuePromise) => {
    if (action.type === 'UNLOCK') {
      const { block } = action.payload
      await queuePromise
      baseAddressFound(block.provenance.getAddress())
      unsubscribe()
    }
  })
  return promise
}

export { createBase }

const prebuiltInterblock = {
  provenance: {
    dmzIntegrity: {
      hash: '16e18b2510c8e15beb165a041bf24aff602b42a6220e9d992ce793c2a0df092b',
      algorithm: 'sha256',
    },
    height: 0,
    address: {
      chainId: {
        hash: 'd9ebd32bacad329c70169da1e55c72d044e4ce0b93b3a11b942b6d3027d0ee74',
        algorithm: 'sha256',
      },
      status: 'GENESIS_8d601ec4-ac6b-4e43-8345-dce986e65685',
    },
    lineage: {},
    integrity: {
      hash: 'c8ac8e773ec1ec3ad2d9f634bc9216a89bab1c3ce540ee2384138cad2718c59e',
      algorithm: 'sha256',
    },
    signatures: [],
  },
  proof: {
    block: 'no proof needed',
    network: {
      networkChannels: [
        '69a5295a9e3c6f0ae1168c434d8b81ea064e150f69ec8c79bacceff47b1a286d',
        '8a52c34adda1258265ff2668c9df406728f0fbf4872b03a1eb4ce49eabaf079e',
        'd6d59ee97bae317db85f3b1381c6102061116861ffea6a4d0682f873c1a2066c',
      ],
    },
    channel: 'c852ff8878d14d9f44952a439bb3c32a69799b3b2eff74fe83c1e53a481e7393',
  },
  network: {
    transmission: {
      address: {
        chainId: {
          hash: '9f71f58cf978462ffdbce6d07bdede517718acde35d240139732145b040497fa',
          algorithm: 'sha256',
        },
        status: 'RESOLVED',
      },
      replies: {},
      requests: [
        {
          type: 'REMOTE_ACTION',
          payload: {},
        },
      ],
      precedent: {
        hash: 'UNKNOWN',
        algorithm: 'sha256',
      },
    },
  },
}
