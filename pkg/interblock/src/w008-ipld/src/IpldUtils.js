import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import assert from 'assert-fast'

export const encode = async (value) => {
  const block = await Block.encode({ value, codec, hasher })
  return block
}

export const encodeV0 = (value) => {
  assert(typeof value !== undefined)
}
