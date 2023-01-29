import * as customers from './customers'
import * as settings from './settings'
import * as routing from './routing'
import * as manifest from './manifest'

export const installer = {
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
        modifications: {
          // any manual changes to the computed paths
          // might include reconciled manifests too
          covenant: 'collection',
          state: {
            template: {},
          },
        },
      },
    },
    // services: { covenant: 'datum' },
    customers: {
      covenant: '#/customers',
    },
    routing: {
      covenant: '#/routing',
    },
    // banking: { covenant: 'datum' },
    settings: {
      covenant: '#/settings',
    },
    about: {
      covenant: 'datum',
      state: {
        readOnly: true, // TODO implement readOnly functionality
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

export const covenants = {
  customers,
  settings,
  routing,
}

export { reducer } from './reducer'

export const name = 'CRM'
