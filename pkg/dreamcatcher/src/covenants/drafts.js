import merge from 'lodash.merge'
import { collection, Request, interchain } from '@dreamcatcher-tech/webdos'
import base from './template'

const template = merge({}, base, {
  schema: {
    title: 'Draft',
    description: `Draft of either a solution or a header or a dispute`,
  },
  uiSchema: { funds: { 'ui:widget': 'hidden' } },
})
template.schema.required = ['type', 'status', 'time']

const installer = {
  state: {
    type: 'COLLECTION',
    schema: {
      type: 'object',
      title: 'Drafts',
      additionalProperties: false,
      properties: {},
    },
    template,
  },
}
const reducer = async (request) => {
  switch (request.type) {
    case 'HEADER': {
      const { time } = request.payload
      const formData = { type: 'header', status: 'draft', time }
      const state = { schema: '..', formData }
      const covenant = 'datum'
      const installer = { state, covenant }
      const name = undefined
      const spawn = Request.createSpawn(name, installer)
      const result = await interchain(spawn)
      return result
    }
  }
  return await collection.reducer(request)
}
const api = {
  ...collection.api,
  createDraftHeader: {
    type: 'object',
    title: 'HEADER',
    description: 'Create a draft packet header',
    additionalProperties: false,
    required: ['time'],
    properties: {
      time: { type: 'integer', minimum: 1 },
    },
  },
}
const name = 'Packets'
export { name, reducer, api, installer }

// Packets should show our Drafts, and pending packets that are in the changes queue
