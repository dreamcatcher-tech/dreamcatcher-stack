import * as packets from './packets'

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
      // show proposed packets
      // ? show your drafts too ?
      covenant: 'collection',
    },
    qa: {
      covenant: 'collection',
    },
  },
}

export const covenants = { packets }

export const reducer = async () => {}

export const name = 'The Dreamcatcher'

/**
 * If you dig into the packet, you can see its header.
 * When in its header, you can opt to fund that header,
 * Or you can opt to modify the header with a change request.
 *
 * ? show your drafts on the list of packets ?
 */
