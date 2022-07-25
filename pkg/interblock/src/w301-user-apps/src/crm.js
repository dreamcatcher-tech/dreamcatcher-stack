const address = (title) => ({
  covenant: 'datum',
  state: {
    type: 'DATUM',
    schema: {
      title,
      type: 'object',
      additionalProperties: false,
      properties: {
        address: { type: 'string', faker: 'address.streetAddress' },
      },
    },
  },
})
const gps = {
  covenant: 'datum',
  state: {
    schema: {
      title: 'Service GPS',
      type: 'object',
      description: `If no lat or long, then the location is not set yet`,
      additionalProperties: false,
      required: [],
      properties: {
        latitude: { type: 'number', faker: 'address.latitude' },
        longitude: { type: 'number', faker: 'address.longitude' },
      },
    },
  },
}
const installer = {
  network: {
    schedule: {
      covenant: 'datum',
      state: {
        formData: {
          commonDate: '2020-01-01',
        },
        uiSchema: 'schedule',
      },
      network: {
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
          type: 'DATUM',
          schema: {
            title: 'Details',
            type: 'object',
            required: ['custNo', 'name'],
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
          network: {
            serviceAddress: address('Service Address'),
            serviceGps: gps,
            billingAddress: address('Billing Address'),
          },
        },
      },
      network: {
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

export { installer }
