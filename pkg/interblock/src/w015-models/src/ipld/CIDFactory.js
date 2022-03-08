import { CID } from 'ipfs-core'
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as hashFactory from 'multiformats/hashes/hasher'

import { encode, decode, code } from '@ipld/dag-cbor'

// const hasher = hashFactory.from({
//   // As per multiformats table
//   // https://github.com/multiformats/multicodec/blob/master/table.csv#L9
//   name: 'sha2-256',
//   code: 0x12,
//   encode: sha256,
// })

const cidVersion = 1

export const CIDFactory = async (obj) => {
  const data = encode(obj)
  const hash = await hasher.digest(data)
  const cid = CID.create(cidVersion, code, hash)
  return cid
}

export const BlockFactory = async (value) => {
  const block = await Block.encode({ value, codec, hasher })
  return block
}
