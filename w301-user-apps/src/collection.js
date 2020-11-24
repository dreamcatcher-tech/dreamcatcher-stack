const initialState = {
  title: 'COLLECTION',
  type: {
    customer: {
      general: 'general',
      postal: 'address',
      service: 'address',
      services: 'services',
    },
  },
}

const reducer = (state, action) => {
  const actions = []
  switch (action.type) {
    case 'ADD':
      /**
       * select the reducer to be used for the child
       * split up the payload into each child
       * run the schema test on each datum
       * spawn a new child for each one
       * add to child key
       *
       */
      break
  }
}

const actions = {
  search: () => ({ type: 'SEARCH' }),
  add: () => ({ type: 'ADD' }),
  updateSchema: () => ({ type: 'UPDATE_SCHEMA' }),
  delete: () => ({ type: 'DELETE' }), // or can delete the child directly ?
}

const collectionFactory = (isExtensible) => {
  // isExtensible means collection cannot be extended with new members
}
