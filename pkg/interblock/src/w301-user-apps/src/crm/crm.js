import * as customers from './customers'
import * as settings from './settings'
import * as routing from './routing'
import * as schedules from './schedules'

export const installer = {
  network: {
    schedule: { covenant: '#/schedules' },
    // services: { covenant: 'datum' },
    customers: { covenant: '#/customers' },
    routing: { covenant: '#/routing' },
    // banking: { covenant: 'datum' },
    settings: { covenant: '#/settings' },
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
  schedules,
}

export { reducer } from './reducer'

export const name = 'CRM'
