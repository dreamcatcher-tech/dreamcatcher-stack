import merge from 'lodash.merge'
import assert from 'assert-fast'
import { useState } from '../../../w002-api'
import { collection } from '../../../w212-system-covenants'

const address = (title) => ({
  title,
  type: 'string',
  faker: 'address.streetAddress',
})
const gps = {
  title: 'Service GPS',
  type: 'object',
  description: `If no lat or long, then the location is not set yet`,
  additionalProperties: false,
  required: [],
  properties: {
    latitude: { type: 'number', faker: 'address.latitude' },
    longitude: { type: 'number', faker: 'address.longitude' },
  },
}
const installer = {
  state: {
    type: 'COLLECTION',
    schema: {
      type: 'object',
      additionalProperties: false,
      title: 'Customers',
      properties: {
        maxCustNo: { type: 'integer', minimum: 1 },
      },
    },
    formData: { maxCustNo: 0 },
    template: {
      type: 'DATUM',
      schema: {
        title: 'Customer',
        type: 'object',
        required: ['custNo', 'name'],
        properties: {
          custNo: {
            title: 'Customer Number',
            type: 'integer',
            minimum: 1,
            maximum: 100000,
          },
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
          serviceAddress: address('Service Address'),
          serviceGps: gps,
          billingAddress: address('Billing Address'),
          importedHash: { type: 'string', faker: 'git.commitSha' },
        },
      },
      uiSchema: {
        importedHash: { 'ui:widget': 'hidden' },
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
    const { formData } = payload
    const { custNo = maxCustNo + 1 } = formData
    if (custNo <= maxCustNo) {
      throw new Error(`Customer number ${custNo} is > ${maxCustNo}`)
    }
    if (custNo !== formData.custNo) {
      payload = merge({}, payload, { formData: { custNo } })
    }
    const result = await collection.reducer({ type, payload })
    await setState(merge({}, state, { formData: { maxCustNo: custNo } }))
    return result
  }
  if (type === 'BATCH') {
    const { batch } = payload
    const [state, setState] = await useState()
    let { maxCustNo } = state.formData
    for (const { formData } of batch) {
      const { custNo } = formData
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
