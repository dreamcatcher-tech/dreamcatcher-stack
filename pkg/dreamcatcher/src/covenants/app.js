import * as packets from './packets'
import * as drafts from './drafts'
import * as changes from './changes'

export const installer = {
  network: {
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
    packets: {
      covenant: '#/packets',
    },
    drafts: {
      covenant: '#/drafts',
    },
    changes: {
      covenant: '#/changes',
    },
  },
}

export const covenants = { packets, drafts, changes }

export const reducer = async () => {}

export const name = 'The Dreamcatcher'

/**
 * If you dig into the packet, you can see its header.
 * When in its header, you can opt to fund that header,
 * Or you can opt to modify the header with a change request.
 *
 * ? show your drafts on the list of packets ?
 */
