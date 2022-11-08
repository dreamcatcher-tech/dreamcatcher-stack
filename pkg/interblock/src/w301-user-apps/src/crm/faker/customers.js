import { JSONSchemaFaker } from 'json-schema-faker'
import { faker } from '@faker-js/faker/locale/en_AU'
import Debug from 'debug'
const debug = Debug('faker:customers')
JSONSchemaFaker.extend('faker', () => faker)

const gps = {
  title: 'Service GPS',
  type: 'object',
  description: `If no lat or long, then the location is not set yet`,
  additionalProperties: false,
  required: ['latitude', 'longitude'],
  properties: {
    latitude: { type: 'number', faker: 'address.latitude' },
    longitude: { type: 'number', faker: 'address.longitude' },
  },
}
export const customers = {
  state: {
    type: 'COLLECTION',
    template: {
      schema: {
        title: 'Details',
        type: 'object',
        required: ['custNo', 'name', 'serviceAddress', 'serviceGps'],
        properties: {
          name: { title: 'Name', type: 'string', faker: 'name.fullName' },
          mobile: {
            title: 'Mobile',
            type: 'string',
            faker: 'phone.number',
          },
          phone: {
            title: 'Phone',
            type: 'string',
            faker: 'phone.number',
          },
          email: {
            title: 'Email',
            type: 'string',
            format: 'email',
            faker: 'internet.email',
          },
          isEmailVerified: {
            title: 'Email Verified',
            type: 'boolean',
            default: false,
          },
          custNo: {
            title: 'Customer Number',
            type: 'integer',
            minimum: 1,
            maximum: 200000,
          },
          serviceAddress: {
            title: 'Service Address',
            type: 'string',
            faker: 'address.streetAddress',
          },
          serviceGps: gps,
          billingAddress: {
            title: 'Billing Address',
            type: 'string',
            faker: 'address.streetAddress',
          },
          importedHash: { type: 'string', faker: 'git.commitSha' },
        },
      },
      uiSchema: {
        importedHash: { 'ui:widget': 'hidden' },
        serviceGps: { 'ui:widget': 'hidden' },
        isEmailVerified: { 'ui:readonly': true },
        custNo: { 'ui:readonly': true },
      },
    },
  },
}

const left = 175.118637
const right = 175.535431
const top = -37.692514
const bottom = -37.922534

const custNos = new Set()
const generate = () => {
  let customer
  do {
    customer = JSONSchemaFaker.generate(customers.state.template.schema)
  } while (custNos.has(customer.custNo))
  custNos.add(customer.custNo)
  customer.serviceGps.latitude = faker.datatype.number({
    min: bottom,
    max: top,
    precision: 0.000001,
  })
  customer.serviceGps.longitude = faker.datatype.number({
    min: left,
    max: right,
    precision: 0.000001,
  })
  return customer
}
debug('start customers')
const subCount = 100
const sub = debug.extend(subCount)
customers.network = new Array(200).fill(0).map((v, i) => {
  if (i % subCount === 0) {
    sub(i)
  }
  const formData = generate()
  return {
    path: formData.custNo.toString(),
    state: {
      schema: '..',
      formData,
    },
  }
})
debug('end customers')
