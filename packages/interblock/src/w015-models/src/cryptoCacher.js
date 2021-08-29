import * as crypto from '../../w012-crypto'
const cacheVerifyHash = async (obj) => {
  // needed so model.clone() can logicize synchronously
  if (typeof obj !== 'object') {
    return
  }
  let toVerify = obj
  if (obj.interblock) {
    // is a txModel
    toVerify = obj.interblock
  }
  if (!toVerify.provenance || !toVerify.provenance.signatures) {
    return
  }
  const { signatures } = toVerify.provenance
  if (!Array.isArray(signatures)) {
    return
  }
  const awaits = signatures.map(async (sig) => {
    const { publicKey, integrity, seal } = sig
    if (!crypto.verifyKeyPairSync(integrity.hash, seal, publicKey.key)) {
      return crypto.verifyHash(integrity.hash, seal, publicKey.key)
    }
  })
  await Promise.all(awaits)

  if (toVerify.network && toVerify.network['.']) {
    await _cacheNetwork(toVerify.network)
  }
}

const _cacheNetwork = async (network) => {
  const awaits = Object.values(network).map(async (channel) => {
    await cacheVerifyHash(channel.heavy)
    const lineageTips = channel.lineageTip.map(cacheVerifyHash)
    await Promise.all(lineageTips)
  })
  await Promise.all(awaits)
}

const cacheVerifyKeypair = async (obj) => {
  const publicKey = obj.publicKey.key
  const secretKey = obj.secretKey
  const toVerify = { publicKey, secretKey }
  if (!crypto.verifyKeyPairSync(toVerify)) {
    await crypto.verifyKeyPair(toVerify)
  }
}

export { cacheVerifyHash, cacheVerifyKeypair }
