import { CID } from 'ipfs-core'
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as cbor from '@ipld/dag-cbor'

export const address = async (obj) => {
  const data = cbor.encode(obj)
  const hash = await hasher.digest(data)
  const cid = CID.createV0(hash)
  return cid
}

export const encode = async (value) => {
  const block = await Block.encode({ value, codec, hasher })
  return block
}
