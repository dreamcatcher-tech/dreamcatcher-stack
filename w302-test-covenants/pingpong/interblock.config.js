/**
 * This is the sketch of a root chain.
 * Config represents the structure of the root chain, and what deployments
 * we want.
 * It is more direct to write in config that to make a reducer.
 * A format checker will ensure consistency.
 * A manifest will be generated for each deployment to allow consistent
 * upgrades.
 */
module.exports = {
  covenants: {
    pingpong: '.',
  },
  chains: {
    ping: {
      covenant: 'pingpong',
      symlinks: {
        other: 'pong',
      },
    },
    pong: {
      covenant: 'pingpong',
      symlinks: {
        other: 'ping',
      },
    },
  },
}
