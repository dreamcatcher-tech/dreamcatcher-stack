import Debug from 'debug'
const debug = Debug('covenant')
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
            required: ['custNo', 'name'],
            // date
            // start hours
            // end hours
            // default activity

            properties: {
              name: { title: 'Name', type: 'string', faker: 'name.findName' },
              custNo: {
                title: 'Personnel ID',
                type: 'integer',
                minimum: 1,
                maximum: 15000,
                default: 555,
              },
              startHours: {
                title: 'Start Hours',
                type: 'string',
                description: 'Start time for work',
                // format: 'date-time',
                // faker: 'time.recent',
              },
              endHours: {
                title: 'End Hours',
                type: 'string',
                description: 'End time for work',
                // format: 'date-time',
                // faker: 'time.recent',
              },
              activity: {
                title: 'Activity',
                type: 'string',
                faker: 'company.catchPhraseNoun',
              },
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
            required: ['payNo', 'to', 'amount'],
            properties: {
              to: {
                title: 'Payment To',
                type: 'string',
                faker: 'name.findName',
              },
              amount: {
                title: 'Amount',
                type: 'number',
                faker: 'finance.amount',
              },
              phone: {
                title: 'Phone',
                type: 'string',
                faker: 'phone.phoneNumber',
              },
              payNo: {
                title: 'Payment Number',
                type: 'integer',
                minimum: 1,
                maximum: 15000,
                default: 555,
              },
            },
          },
          uiSchema: {
            importedHash: { 'ui:widget': 'hidden' },
            isEmailVerified: { 'ui:readonly': true },
            custNo: { 'ui:readonly': true },
          },
          namePath: ['payNo'],
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
          title: 'About',
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
        },
        formData: {
          title: ' TIMESHEETpro',
          description: 'Simple timesheet tracking tooling',
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
