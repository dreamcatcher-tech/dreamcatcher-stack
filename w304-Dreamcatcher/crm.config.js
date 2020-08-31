const path = require('path')

/**
 * Processes that the program runs:
 *  - customer CUD
 *  - invoice generation
 *  - banking processing
 *  - services CUD
 *  - routing
 */
module.exports = {
  covenants: {
    users,
    customers,
    customer,
    routes,
  },
  chains: {
    users: {
      covenant: 'users',
    },
    customers: {
      covenant: 'customers',
    },
    routes: {
      covenant: 'routes',
      symlinks: {
        customers: 'customers',
      },
    },
    sectors: {
      covenant: 'sectors',
      symlinks: {
        routes: 'routes',
      },
    },
  },
}
