import merge from 'lodash.merge'
import assert from 'assert-fast'
import { useState } from '../../../w002-api'
import { collection } from '../../../w212-system-covenants'

const address = (title) => ({
  title,
  type: 'string',
  faker: 'location.streetAddress',
})
const gps = {
  title: 'Service GPS',
  type: 'object',
  description: `If no lat or long, then the location is not set yet`,
  additionalProperties: false,
  required: [],
  properties: {
    latitude: { type: 'number', faker: 'location.latitude' },
    longitude: { type: 'number', faker: 'location.longitude' },
  },
}
const installer = {
  schema: {
    type: 'object',
    additionalProperties: false,
    title: 'Customers',
    description: `Manages a list of customers.  The customer number is automatically generated and is unique.  The schema for new items in this collection is given in the state key 'template'`,
    properties: {
      maxCustNo: { type: 'integer', minimum: 1 },
      formData: { type: 'object' }, // TODO hoist into pulse level schema
      template: { type: 'object' },
      type: { const: 'COLLECTION' },
    },
  },
  state: {
    type: 'COLLECTION',
    formData: { maxCustNo: 0 },
    template: {
      type: 'DATUM',
      schema: {
        title: 'Customer',
        type: 'object',
        required: ['name'],
        properties: {
          custNo: {
            title: 'Customer Number',
            type: 'integer',
            minimum: 1,
            maximum: 100000,
          },
          name: { title: 'Name', type: 'string', faker: 'person.fullName' },
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
          isEmailVerified: {
            title: 'Email Verified',
            type: 'boolean',
            default: false,
          },
          email: {
            title: 'Email',
            type: 'string',
            format: 'email',
            faker: 'internet.email',
          },
          isGeocodedGps: {
            title: 'Geocoded GPS',
            type: 'boolean',
            default: false,
          },
          isGpsValid: {
            title: 'Is GPS Valid',
            type: 'boolean',
            default: false,
          },
          serviceAddress: address('Service Address'),
          serviceGps: gps,
          billingAddress: address('Billing Address'),
          importedHash: { type: 'string', faker: 'git.commitSha' },
          // services: { type: 'object',}
        },
      },
      uiSchema: {
        importedHash: { 'ui:widget': 'hidden' },
        isGeocodedGps: { 'ui:widget': 'hidden' },
        isGpsValid: { 'ui:widget': 'hidden' },
        serviceAddress: { 'ui:widget': 'hidden' },
        serviceGps: { 'ui:widget': 'hidden' },
        isEmailVerified: { 'ui:readonly': true },
        custNo: { 'ui:readonly': true },
      },
      namePath: 'custNo',
    },
  },
}
const reducer = async (request) => {
  let { type, payload } = request
  if (type === 'ADD') {
    const [state, setState] = await useState()
    const {
      formData: { maxCustNo },
    } = state
    assert(Number.isInteger(maxCustNo), 'maxCustNo is not an integer')
    const { custNo = maxCustNo + 1 } = payload
    if (custNo <= maxCustNo) {
      throw new Error(`Customer number ${custNo} is > ${maxCustNo}`)
    }
    if (custNo !== payload.custNo) {
      payload = merge({}, payload, { custNo })
    }
    const result = await collection.reducer({ type, payload })
    await setState(merge({}, state, { formData: { maxCustNo: custNo } }))
    return result
  }
  if (type === 'BATCH') {
    const { batch } = payload
    const [state, setState] = await useState()
    let { maxCustNo } = state.formData
    for (const { custNo } of batch) {
      if (custNo > maxCustNo) {
        maxCustNo = custNo
      }
    }
    if (maxCustNo > state.formData.maxCustNo) {
      await setState({
        ...state,
        formData: { ...state.formData, maxCustNo },
      })
    }
  }

  return collection.reducer(request)
}
const { api } = collection
const name = 'Customers'
export { name, reducer, api, installer }
