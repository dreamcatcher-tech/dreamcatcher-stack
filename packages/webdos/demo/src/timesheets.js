const debug = require('debug')('covenant')
const address = (title) => ({
  schema: {
    title,
    type: 'object',
    additionalProperties: false,
    properties: { address: { type: 'string', faker: 'address.streetAddress' } },
  },
})
const gps = {
  schema: {
    title: 'Service GPS',
    type: 'object',
    additionalProperties: false,
    required: ['latitude', 'longitude'],
    properties: {
      latitude: { type: 'number', faker: 'address.latitude' },
      longitude: { type: 'number', faker: 'address.longitude' },
    },
  },
}
const installer = {
  children: {
    sites: { covenant: 'datum' },
    personnel: {
      covenant: 'collection',
      state: {
        datumTemplate: {
          schema: {
            title: 'Person',
            type: 'object',
            required: ['custNo', 'name', 'isEmailVerified'],
            properties: {
              name: { title: 'Name', type: 'string', faker: 'name.findName' },
              mobile: {
                title: 'Mobile',
                type: 'string',
                faker: 'phone.phoneNumber',
              },
              phone: {
                title: 'Phone',
                type: 'string',
                faker: 'phone.phoneNumber',
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
                title: 'Personnel Id',
                type: 'integer',
                minimum: 1,
                maximum: 15000,
                default: 555,
              },
              importedHash: { type: 'string', faker: 'git.commitSha' },
            },
          },
          uiSchema: {
            importedHash: { 'ui:widget': 'hidden' },
            isEmailVerified: { 'ui:readonly': true },
            custNo: { 'ui:readonly': true },
          },
          namePath: ['custNo'],
          children: {
            serviceAddress: address('Service Address'),
            serviceGps: gps,
            billingAddress: address('Billing Address'),
          },
        },
      },
    },
    timesheets: {
      covenant: 'collection',
      state: {
        datumTemplate: {
          schema: {
            title: 'Timesheet',
            type: 'object',
            required: ['custNo', 'name', 'isEmailVerified'],
            properties: {
              name: { title: 'Name', type: 'string', faker: 'name.findName' },
              mobile: {
                title: 'Mobile',
                type: 'string',
                faker: 'phone.phoneNumber',
              },
              phone: {
                title: 'Phone',
                type: 'string',
                faker: 'phone.phoneNumber',
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
                maximum: 15000,
                default: 555,
              },
              importedHash: { type: 'string', faker: 'git.commitSha' },
            },
          },
          uiSchema: {
            importedHash: { 'ui:widget': 'hidden' },
            isEmailVerified: { 'ui:readonly': true },
            custNo: { 'ui:readonly': true },
          },
          namePath: ['custNo'],
          children: {
            serviceAddress: address('Service Address'),
            serviceGps: gps,
            billingAddress: address('Billing Address'),
          },
        },
      },
    },
    payments: {
      covenant: 'collection',
      state: {
        datumTemplate: {
          schema: {
            title: 'Payment',
            type: 'object',
            required: ['custNo', 'name', 'isEmailVerified'],
            properties: {
              name: { title: 'Name', type: 'string', faker: 'name.findName' },
              mobile: {
                title: 'Mobile',
                type: 'string',
                faker: 'phone.phoneNumber',
              },
              phone: {
                title: 'Phone',
                type: 'string',
                faker: 'phone.phoneNumber',
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
                maximum: 15000,
                default: 555,
              },
              importedHash: { type: 'string', faker: 'git.commitSha' },
            },
          },
          uiSchema: {
            importedHash: { 'ui:widget': 'hidden' },
            isEmailVerified: { 'ui:readonly': true },
            custNo: { 'ui:readonly': true },
          },
          namePath: ['custNo'],
          children: {
            serviceAddress: address('Service Address'),
            serviceGps: gps,
            billingAddress: address('Billing Address'),
          },
        },
      },
    },
    settings: {
      covenant: 'datum',
      state: {
        schema: {
          title: 'Settings',
          type: 'object',
          required: ['isTerminalVisible'],
          additionalProperties: false,
          properties: {
            isTerminalVisible: {
              title: 'Show Terminal',
              type: 'boolean',
              default: true,
            },
            isGuiVisible: {
              title: 'Show GUI',
              type: 'boolean',
              default: true,
            },
            isFakeDataEnabled: {
              title: 'Allow Fake Data',
              type: 'boolean',
              default: true,
            },
          },
        },
      },
    },
    about: {
      covenant: 'datum',
      state: {
        schema: {
          title: 'About CRM',
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
        },
        formData: {
          title: 'CRM',
          description: 'Simple Customer Relationship Management',
        },
      },
    },
    account: {
      covenant: 'datum',
      state: {
        schema: {
          title: 'Account',
          type: 'object',
          properties: {
            name: { title: 'Name', type: 'string' },
            email: {
              title: 'Email',
              type: 'string',
              format: 'email',
            },
          },
        },
      },
    },
  },
}

const covenantId = { name: 'timesheets' }
const covenants = {
  testCovenant: {
    reducer: (state, action) => {
      debug(`testCovenant reducer`, action)
      return {}
    },
    actions: { test: () => ({ type: 'TEST', payload: {} }) },
  },
}
export default { covenantId, installer, covenants }
