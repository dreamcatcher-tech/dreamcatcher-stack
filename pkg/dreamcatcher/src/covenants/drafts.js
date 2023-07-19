import merge from 'lodash.merge'
import assert from 'assert-fast'
import { useState, collection } from '@dreamcatcher-tech/webdos'
import base from './template'

const template = merge({}, base, {
  schema: {
    title: 'Draft',
    description: `Draft of either a solution or a header or a dispute`,
  },
})

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
const { api, reducer } = collection
const name = 'Packets'
export { name, reducer, api, installer }

// Packets should show our Drafts, and pending packets that are in the changes queue
