/**
 * Contains the header format for a packet.
 * A datum with a schema.
 * Lineage is stored in the chain format, not the state data.
 *
 */

// json schema layout of a header
const header = {
  type: 'object',
  properties: {
    title: { type: 'string' },
  },
}
