export const name = 'sector'
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
      allowAdditionalProperties: false,
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
export const state = {
  schema: {
    title: 'Sector',
    description: `A sector is a geographic area that is used to group customers 
        for scheduling purposes.`,
    type: 'object',
    required: ['name', 'color', 'geometry'],
    allowAdditionalProperties: false,
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
  formData: {},
  uiSchema: {
    geometry: { 'ui:widget': 'hidden' },
    order: { 'ui:widget': 'sorter' },
  },
}
