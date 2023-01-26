import { collection } from '../../../w212-system-covenants'

const address = (title) => ({
  title,
  type: 'object',
  additionalProperties: false,
  properties: {
    address: { type: 'string', faker: 'address.streetAddress' },
  },
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
    schema: {},
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
      namePath: ['custNo'],
    },
  },
}
const { reducer, api } = collection
const name = 'Customers'
export { name, reducer, api, installer }
