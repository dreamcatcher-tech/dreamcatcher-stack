/**
 * Network options
 */

const api = {
  mount: {
    description: `Create or update a mount of a remote chain`,
    properties: {
      noSkip: {
        type: 'boolean',
        description: `When fetching updates for the remote, ensure every pulse in the lineage is fetched, as opposed to lazily fetching only the latest known`,
      },
    },
  },
}
