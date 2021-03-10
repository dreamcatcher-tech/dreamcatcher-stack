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
            required: ['custNo', 'firstName'],
            properties: {
              custNo: { type: 'integer', min: 0, default: 555 },
              firstName: { type: 'string', faker: 'name.firstName' },
              lastName: { type: 'string' },
            },
          },
          namePath: ['firstName'],
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
      children: {
        // bob: {},
        // charlie: {},
        // marg: {},
        // joshua: {},
        // mckenzie: {},
        // atlas: {},
        // bartholemew: {},
        // wesley: {},
        // gareth: {},
        // mcnuggets: {},
        // cyril: {},
        // carlos: {},
        // wendey: {},
        // kylee: {},
        // roger: {},
      },
    },
    banking: { covenant: 'datum' },
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
          description: 'Simple Customer Relationship Management with mapping',
        },
      },
    },
    account: { covenant: 'datum' },
  },
}

const covenantId = { name: 'crm' }
const crm = { covenantId, install }

module.exports = { crm }
