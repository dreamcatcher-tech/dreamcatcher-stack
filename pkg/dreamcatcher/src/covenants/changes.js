import merge from 'lodash.merge'
import assert from 'assert-fast'
import { useState, collection } from '@dreamcatcher-tech/webdos'
import base from './template'

const template = merge({}, base, {
  schema: {
    title: 'Change',
    description: `System changes which are either a solution, a header, modification, or a dispute`,
  },
  uiSchema: { type: { 'ui:widget': 'hidden' } },
})

const installer = {
  state: {
    type: 'COLLECTION',
    schema: {
      type: 'object',
      title: 'Changes',
      additionalProperties: false,
      properties: {},
    },
    template,
  },
}
const { api, reducer } = collection
const name = 'Packets'
export { name, reducer, api, installer }
