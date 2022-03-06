import { CID } from 'ipfs-core'
import { CIDFactory, BlockFactory } from '../src/CIDFactory'
import { encode, decode, code } from '@ipld/dag-cbor'
import assert from 'assert-fast'

describe('CIDFactory', () => {
  test('POJO', async () => {
    const obj = {
      x: 1,
      y: [2, 3],
      z: {
        b: null,
        c: 'string',
        'lol/d': 'lol',
      },
      a: 'asdfasdfasdfasdfasdfasdfasdf',
    }
    const cid = await CIDFactory(obj)
    assert(CID.asCID(cid))

    const block = await BlockFactory(obj)

    obj.linkTest = { m: block.cid }
    const linkedBlock = await BlockFactory(obj)
    console.dir(linkedBlock, { depth: Infinity })

    for await (const r of linkedBlock.links()) {
      console.dir(r, { depth: Infinity })
    }
  })
  test('Links', () => {
    const obj = {
      x: 1,
      /* CID instances are encoded as links */
      y: [2, 3, CID.parse('QmaozNR7DZHQK1ZcU9p7QdrshMvXqWK6gpu5rmrkPdT3L4')],
      z: {
        a: CID.parse('QmaozNR7DZHQK1ZcU9p7QdrshMvXqWK6gpu5rmrkPdT3L4'),
        b: null,
        c: 'string',
      },
    }
  })
})
