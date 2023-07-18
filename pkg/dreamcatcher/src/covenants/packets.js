import merge from 'lodash.merge'
import assert from 'assert-fast'
import { useState, collection } from '@dreamcatcher-tech/webdos'

const installer = {
  state: {
    type: 'COLLECTION',
    schema: {
      type: 'object',
      additionalProperties: false,
      title: 'Packets',
      properties: {
        // TODO handle multiple chains having different sync states
        lastBlockNumber: {
          type: 'integer',
          minimum: 0,
          description: 'The last block number that was synced with.',
        },
      },
    },
    formData: { lastBlockNumber: 0 },
    template: {
      // if draft, and has sent, show as pending
      // store the tx so we can rebroadcast once net returns
      type: 'DATUM',
      schema: {
        title: 'Packet',
        type: 'object',
        required: ['tokenId', 'title'],
        properties: {
          tokenId: {
            title: 'ID',
            type: 'integer',
            minimum: 1,
          },
          name: { title: 'Name', type: 'string', faker: 'person.fullName' },
          // TODO use hash schema
          contents: { type: 'string', faker: 'git.commitSha' },
        },
      },
      uiSchema: {
        lastBlockNumber: { 'ui:widget': 'hidden' },
      },
      namePath: 'tokenId',
    },
  },
}
const { api, reducer } = collection
const name = 'Packets'
export { name, reducer, api, installer }
