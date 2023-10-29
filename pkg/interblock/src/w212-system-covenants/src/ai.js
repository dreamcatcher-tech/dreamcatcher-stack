/**
 * ? how to stream back an AI response into a chain ?
 * Probably make a new pulse each response that comes in, and then do a
 * history shortcut when its finished, so the stream path can be pruned.
 * Stream back a generator, so can be yielded multiple times
 * Provide a hack where a side channel can be used to tap partial responses
 *
 * Want to load up the whole filesystem, copy in the files, then start bots.
 *
 * Could make all AI requests go thru a gateway, so it can be throttled, and
 * logged globally.
 *
 * Since the updates are ephemeral, provide them out of band.
 * Once the action resolves, replace with a permanent thing.
 */

const api = {
  prompt: {
    type: 'object',
    title: 'PROMPT',
    description:
      'Send a prompt to the AI and start streaming back the response. The reply will be the full reply from the model. Partial results need to be sampled out of band',
    additionalProperties: false,
    required: ['prompt'],
    properties: {
      formData: { type: 'object' },
      network: {
        type: 'object',
        description: 'Recursively defined children',
        // patternProperties: { '(.*?)': { $ref: '#' } },
      },
    },
  },
  batch: {
    type: 'object',
    title: 'BATCH',
    description: 'Add multiple elements to the collection as a batch',
    additionalProperties: false,
    required: ['batch'],
    properties: {
      batch: { type: 'array' }, // TODO use 'add' schema
    },
  },
  setTemplate: {
    type: 'object',
    title: 'SET_TEMPLATE',
    description: 'Change the template of the elements of this collection',
    additionalProperties: false,
    required: ['schema'],
    properties: {
      type: { type: 'string' },
      schema: { type: 'object' },
      network: { type: 'object' },
    },
  },
  search: {
    type: 'object',
    title: 'SEARCH',
    description: 'Search through this collection',
  },
}
