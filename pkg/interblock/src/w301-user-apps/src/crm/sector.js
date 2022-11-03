export const name = 'sector'
export const COLORS = [
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
    type: { enum: ['Feature'] },
    properties: { type: 'object' }, // TODO set zero keys
    geometry: {
      title: 'GeoJSON Polygon',
      type: 'object',
      required: ['type', 'coordinates'],
      allowAdditionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['Polygon'],
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
    required: ['color', 'geometry'],
    allowAdditionalProperties: false,
    properties: {
      color: {
        title: 'Color',
        description: 'The color of the sector',
        enum: COLORS,
      },
      frequencyInDays: { type: 'integer', title: 'Frequency in Days' },
      frequencyOffset: { type: 'integer', title: 'Frequency Offset' },
      geometry,
    },
  },
  formData: {},
}
