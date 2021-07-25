/**
 * This is the sketch of a root chain.
 * Config represents the structure of the root chain, and what deployments
 * we want.
 * It is more direct to write in config that to make a reducer.
 * A format checker will ensure consistency.
 * A manifest will be generated for each deployment to allow consistent
 * upgrades.
 * Covenants will be bundled and hashed client side, then uploaded.
 */
module.exports = {
  covenants: {
    pingpong: '.',
  },
  chains: {
    ping: {
      covenant: 'pingpong',
    },
    pong: {
      covenant: 'pingpong',
    },
  },
}
