import { JSONSchemaFaker } from 'json-schema-faker'
import { faker } from '@faker-js/faker/locale/en_AU'
import Debug from 'debug'
import { installer } from '../customers'
const debug = Debug('faker:customers')
faker.seed(0)
JSONSchemaFaker.extend('faker', () => faker)
JSONSchemaFaker.option('random', () => {
  const random = faker.random.numeric()
  return random
})
const left = 175.118637
const right = 175.535431
const top = -37.692514
const bottom = -37.922534
let custNo = 777

export const generateSingle = () => {
  const { schema } = installer.state.template
  const formData = JSONSchemaFaker.generate(schema)
  formData.serviceGps = {}
  formData.serviceGps.latitude = faker.datatype.number({
    min: bottom,
    max: top,
    precision: 0.000001,
  })
  formData.serviceGps.longitude = faker.datatype.number({
    min: left,
    max: right,
    precision: 0.000001,
  })
  formData.custNo = custNo++
  return { formData }
}

export const generateBatch = (count = 20) => {
  debug('start customers')
  const batch = []
  for (let i = 0; i < count; i++) {
    const customer = generateSingle()
    batch.push(customer)
  }
  debug('end customers')
  return batch
}
