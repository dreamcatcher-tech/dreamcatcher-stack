import * as customers from './customers'
import * as settings from './settings'
import * as routing from './routing'
import * as schedules from './schedules'
const schema = {
  type: 'object',
  title: 'CRM - Customer Relationship Management',
  description: `
  A Customer Relationship Management (CRM) system designed for truck routing is specialized software that streamlines and optimizes the delivery process for businesses that rely on truck transportation. Its primary functions include:
  
  Route Optimization: The CRM system analyzes various factors such as traffic patterns, weather conditions, and delivery windows to create efficient truck routes. This helps in reducing fuel consumption and travel time, ensuring timely deliveries.
  
  Customer Management: It stores and manages detailed customer information, including delivery locations, preferred delivery times, and special instructions. This data is used to enhance customer satisfaction by personalizing the delivery experience.`,
}
export const installer = {
  schema,
  network: {
    schedules: { covenant: '#/schedules' },
    customers: { covenant: '#/customers' },
    routing: { covenant: '#/routing' },
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
