const install = {
  children: {
    schedule: {
      covenant: 'datum',
      state: {
        formData: {
          commonDate: '2020-01-01',
        },
        uiSchema: 'schedule',
      },
      children: {
        exceptions: {
          covenant: 'collection',
          state: {
            datumTemplate: {
              // stuff
            },
          },
        },
      },
    },
    services: { covenant: 'datum' },
    customers: {
      covenant: 'collection',
      state: {
        datumTemplate: {
          schema: {
            title: 'Customer',
            type: 'object',
            required: ['firstName'],
            properties: {
              firstName: { type: 'string' },
            },
          },
          children: {
            address: {
              schema: {
                title: 'Address',
                type: 'object',
                properties: { address: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    banking: { covenant: 'datum' },
    settings: { covenant: 'datum' },
    about: { covenant: 'datum' },
    logout: { covenant: 'datum' },
  },
}

const covenantId = { name: 'crm' }
const crm = { covenantId, install }

module.exports = { crm }
