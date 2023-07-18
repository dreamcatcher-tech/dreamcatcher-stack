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
    /**
     * @param {string} name Name of the token
     * @param {string} description description of the token
     * @param {string} image link to the image URL
     * @param {Array} attributes The attributes of the token
     * @param {string} external_url The external link of the token
     * @param {string} animation_url Link to the animation such as music, video
     * @param {string} background_color The background color of the token
     * @param {string} youtube_url The youtube url of the token
     */
    template: {
      // if draft, and has sent, show as pending
      // store the tx so we can rebroadcast once net returns
      type: 'DATUM',
      schema: {
        title: 'Packet',
        description: `Schema for a packet, designed to be a superset of the 
        opensea token level standard`,
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
