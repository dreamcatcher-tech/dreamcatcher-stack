import { parse } from 'ipld-schema'
import validate from '@ipld/schema-validation'
// import { create as validate } from 'ipld-schema-validator' // rvagg
import { CID, create } from 'ipfs-core'
import { schemas } from '../src/schemas/ipldSchemas'
import assert from 'assert-fast'

let schema = parse(`
  type SimpleStruct struct {
    foo Int
    bar Bool
    baz String
  }
  type MyMap { String: SimpleStruct }
  type Any union {
	| Bool   bool
	| Int    int
	| Float  float
	| String string
	| Bytes  bytes
	| Map    map
	| List   list
	| Link   link
  } representation kinded
  type Block struct {
    boo &SimpleStruct
  }
`)

const js = {
  types: {
    SimpleStruct: {
      title: 'Easdf',
      kind: 'struct',
      fields: {
        foo: { type: 'Int' },
        bar: { type: 'Bool' },
        baz: { type: 'String' },
      },
      representation: { map: {} },
    },
    MyMap: { kind: 'map', keyType: 'String', valueType: 'SimpleStruct' },
  },
}

describe('ipld schema', () => {
  test.only('parse', () => {
    const control = validate(js)
    console.dir(schema, { depth: Infinity })
    const result = control({ b: { foo: 1, bar: true, baz: 'hello' } }, 'MyMap')
    assert(result)

    const validator = validate(schemas)
    const action = validator({ type: 'star', payload: {} }, 'Action')
    const binary = CID.parse(
      'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
    )
    console.dir(binary.toJSON())
    const action2 = validator({ type: 'star', payload: {}, binary }, 'Action')

    const provenance = validator(
      { genesis: binary, contents: binary },
      'Provenance'
    )
    class Class {
      genesis = binary
      get contents() {
        return binary
      }
      b = 'd'
      get m() {
        return 5
      }
    }
    const c = new Class()
    for (const [k, v] of Object.entries(c)) {
      console.log(k, v)
    }
    validator(c, 'Provenance')
    console.log({ ...c })
  })
})
