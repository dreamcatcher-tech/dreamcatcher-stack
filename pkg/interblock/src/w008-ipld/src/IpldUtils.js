import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { from } from 'multiformats/hashes/hasher'
import { sha256 } from '@noble/hashes/sha256'
import assert from 'assert-fast'

export const hasher = from({
  // synchronous hasher needed in browser else async crypto.subtle is used
  name: 'sha2-256',
  code: 0x12,
  encode: sha256,
})

// TODO collect stats about size of blocks, blockrate self, blockrate wall
export const encode = async (value) => {
  try {
    const block = await Block.encode({ value, codec, hasher })
    return block
  } catch (e) {
    console.error(e)
    throw e
  }
}

export const decode = async (bytes) => {
  assert(bytes instanceof Uint8Array, `bytes not Uint8Array: ${typeof bytes}`)
  try {
    const block = await Block.decode({ bytes, codec, hasher })
    return block
  } catch (e) {
    console.error(e)
    throw e
  }
}
