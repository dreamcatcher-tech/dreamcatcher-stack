import { JSONSchemaFaker } from 'json-schema-faker'
import { faker } from '@faker-js/faker/locale/en_AU'
import Debug from 'debug'
import { installer } from '../customers'
import assert from 'assert-fast'
import { PolygonLut } from '../PolygonLut'
const debug = Debug('faker:customers')
faker.seed(0)
JSONSchemaFaker.extend('faker', () => faker)
JSONSchemaFaker.option('random', () => {
  const random = faker.random.numeric()
  return random
})
const minX = 175.118637
const maxX = 175.535431
const minY = -37.922534
const maxY = -37.692514
let custNo = 777

export const reset = () => {
  faker.seed(0)
  custNo = 777
}

export const generateSingle = (lut, outside = false) => {
  assert(!lut || lut instanceof PolygonLut, 'lut must be a PolygonLut')
  assert.strictEqual(typeof outside, 'boolean', 'outside must be a boolean')
  const { schema } = installer.state.template
  const formData = JSONSchemaFaker.generate(schema)
  formData.serviceGps = {}
  const isValid = (gps) => {
    if (!lut) {
      return true
    }
    if (outside) {
      return !lut.includes(gps)
    }
    return lut.includes(gps)
  }
  do {
    formData.serviceGps.latitude = faker.datatype.number({
      min: lut?.bounds.minY || minY,
      max: lut?.bounds.maxY || maxY,
      precision: 0.000001,
    })
    formData.serviceGps.longitude = faker.datatype.number({
      min: lut?.bounds.minX || minX,
      max: lut?.bounds.maxX || maxX,
      precision: 0.000001,
    })
  } while (!isValid(formData.serviceGps))
  formData.custNo = custNo++
  return { formData }
}

export const generateBatch = (count = 20, bounds, outside) => {
  debug('start customers')
  const batch = []
  for (let i = 0; i < count; i++) {
    const customer = generateSingle(bounds, outside)
    batch.push(customer)
  }
  debug('end customers')
  return batch
}

export const generateBatchInside = (sectors, count = 20) => {
  assert(Array.isArray(sectors), 'sectors must be an array')
  assert(Number.isInteger(count), 'count must be an integer')
  const geometry = sectors.map((sector) => sector.formData)
  debug('generateBatchInside', geometry)

  const lut = PolygonLut.create(geometry)
  return generateBatch(count, lut)

  // get the bounds of the geometry
  // make a lut of the geometry
}
export const generateBatchOutside = (sectors, count = 20) => {
  assert(Array.isArray(sectors), 'sectors must be an array')
  assert(Number.isInteger(count), 'count must be an integer')
  const geometry = sectors.map((sector) => sector.formData)
  debug('generateBatchOutside', geometry)
  const lut = PolygonLut.create(geometry)
  const outside = true
  return generateBatch(count, lut, outside)

  // get the bounds of the geometry
  // make a lut of the geometry
}
