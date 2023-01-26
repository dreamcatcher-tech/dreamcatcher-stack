import { collection } from '../../../w212-system-covenants'

const COLORS = [
  'red',
  'orange',
  'yellow',
  'cyan',
  'purple',
  'violet',
  'pink',
  'green',
  'black',
]
const geometry = {
  type: 'object',
  required: ['type', 'properties', 'geometry'],
  properties: {
    type: { const: 'Feature' },
    properties: { type: 'object', maxProperties: 0 },
    geometry: {
      title: 'GeoJSON Polygon',
      type: 'object',
      required: ['type', 'coordinates'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          const: 'Polygon',
        },
        coordinates: {
          type: 'array',
          items: {
            type: 'array',
            minItems: 4,
            items: {
              type: 'array',
              minItems: 2,
              items: {
                type: 'number',
              },
            },
          },
        },
      },
    },
  },
}
const template = {
  type: 'DATUM',
  schema: {
    title: 'Sector',
    description: `A sector is a geographic area that is used to group customers 
        for scheduling purposes.`,
    type: 'object',
    required: ['name', 'color', 'geometry'],
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        title: 'Name',
        description: 'The name of the sector',
      },
      color: {
        title: 'Color',
        description: 'The color of the sector',
        enum: COLORS,
      },
      frequencyInDays: { type: 'integer', title: 'Frequency in Days' },
      frequencyOffset: { type: 'integer', title: 'Frequency Offset' },
      order: {
        type: 'array',
        title: 'Order',
        uniqueItems: true,
        items: { type: 'string' },
        default: [],
      },
      geometry,
    },
  },
  uiSchema: {
    geometry: { 'ui:widget': 'hidden' },
    order: { 'ui:widget': 'hidden' },
  },
}

/**
 * Create a "universal sector" which is used to set the zoom boundary of the app.
 * All sectors are within this, and all customers too.
 * It has order of customers, but this order can never be set.
 * Whenever geometry changes, membership is checked against intersections,
 * past intersections, and the universal set.
 */

const installer = {
  state: {
    type: 'COLLECTION',
    schema: {
      title: 'Routing',
      description: `Routing manages geographic boundaries to group customers
      together for service by a truck, and the order of all the customers`,
      type: 'object',
      required: ['commonDate'],
      properties: {
        commonDate: {
          type: 'string',
          description: `The date that all sectors share in common`,
          format: 'date',
        },
      },
    },
    formData: {
      commonDate: '2017-01-30',
    },
    template,
  },
}
const api = {
  ...collection.api,

  update: {
    type: 'object',
    title: 'UPDATE',
    description: `Something in the customers collection has changed,
    and so the memberships in each sector should be recomputed.
    To avoid a lot of updates, this calculation is done at the root first,
    then only when differences are detected is the update action triggered
    in routing.`,
    additionalProperties: false,
    properties: {},
  },
}
const name = 'Routing'
const { reducer } = collection
export { name, reducer, api, installer }
