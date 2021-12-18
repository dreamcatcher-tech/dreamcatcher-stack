import { mixin } from '../MapFactory'

const schema = {
  title: 'Acl',
  type: 'object',
  //   description: `Access control list, power rating, alias table, and chargeout rates
  // Groups are similar to roles.
  // Groups contain only Actors
  // Actors are similar to users, but represent chains
  // This is the alias table
  // Actors contain only a single ChainId
  // This might be extended to cover token balance from other chains.
  // Could use proofs to show your current balance when an action was requested.

  // Alias table is contained within the join slices directly.`,
  required: ['groups', 'everybody', 'balance', 'shares', 'costs'],
  additionalProperties: false,
  properties: {
    groups: { type: 'object' },
    everybody: { type: 'object' },
    balance: { type: 'object' },
    shares: { type: 'object' },
    costs: { type: 'object' },
  },
}
export class Acl extends mixin(schema) {
  static schema = schema
  static create() {
    const params = {
      groups: {
        // for the action costs
        children: {
          alice: 50,
          chain123: 60,
        },
        founders: {
          chain123: 1,
        },
      },
      everybody: {}, // everybody can never vote ?
      balance: {
        // inbuilt coin balance of this chain ?
        // how many jewels it has in credit ?
      },
      shares: {
        // tokens, or shares
        // or, sum the groups to 1
        children: 0,
        founders: 100,
      },
      // say the vote power needed to execute an action, to allow councils ?
      costs: {
        // allow jewel multiple for all actions
        // allow free, so cost to all callers is zero
        '*': {
          children: 50, // can be in jewels or in coins, or some formula
        },
      },
    }
    return super.create(params)
  }
  isAllowed(action, alias, address) {
    // look up the table and return true if this action is allowed based on acl config
    const isAllowed = false
    return { isAllowed }
  }
}
