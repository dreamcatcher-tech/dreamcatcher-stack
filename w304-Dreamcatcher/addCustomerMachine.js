/**
 * Add customer walks through the steps required to insert a customer.
 * Ensures that metadata such as 'geocoded' and 'routed' are updated.
 * This machine is the only way to alter the metadata flags in the datums.
 */
const addCustomerMachine = Machine({
  id: 'addCustomer',
  initial: 'idle',
  context: {},
  states: {
    idle: {
      on: {
        ADD_CUSTOMER: 'loading',
      },
    },
    loading: {
      on: {
        RESOLVE: 'success',
        REJECT: 'failure',
      },
    },
    cancel: {
      on: {
        CONFIRM_CANCEL: 'delete',
        BACKTRACK: 'add.history',
      },
    },
    delete: {
      invoke: {
        src: 'delete',
        onDone: 'done',
      },
    },
    done: {
      type: 'final',
    },
    failure: {
      on: {
        RETRY: {
          target: 'loading',
          actions: assign({
            retries: (context, event) => context.retries + 1,
          }),
        },
      },
    },
  },
})
