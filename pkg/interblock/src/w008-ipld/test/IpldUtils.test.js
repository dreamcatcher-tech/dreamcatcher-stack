import { CID } from 'multiformats/cid'
import { encode } from '../src/IpldUtils'
import assert from 'assert-fast'

describe('IpldUtils', () => {
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
    const block = await encode(obj)

    obj.linkTest = { m: block.cid }
    const linkedBlock = await encode(obj)
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
