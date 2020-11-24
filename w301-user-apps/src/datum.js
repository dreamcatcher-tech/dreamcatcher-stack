const faker = require('faker')

const initialState = {
  idPath: 'id', // array of keys, or single key
  formData: {},
  schema: {},
  schemaVersion: '',
  children: {},
  uiSchema: {
    // how to display this datum
  },
  subscribers: [
    // list of paths that need to be notified when changes occur
    // errors are ignored
  ],
}
const reducer = (state, action) => {
  const { isTest } = action.payload
  switch (action.type) {
    case 'UPDATE_DATA':
      if (isTest) {
        // try deduce what faker methods to do, or allow user to supply a
        // mapping between schema paths and faker methods
      }
  }
}

const actions = {
  // create is handled by init ?
  create: (formData, schema) => ({ type: 'CREATE' }),
  update: () => ({ type: 'UPDATE', payload }),
  // delete is system level action
  updateSchema: (schema, childSchemas) => ({ type: 'UPDATE_SCHEMA', payload }),
  updateUI: () => ({ type: 'UPDATE_UI', payload }),
  subscribe: (...paths) => ({ type: 'SUBSCRIBE', payload: paths }),
  unsubscribe: (...paths) => ({ type: 'UN_SUBSCRIBE', payload: paths }),
}

const datumFactory = (schema, ui, isDirectEdit) => {
  // if isDirectEdit flag set, then can only be updated by the parent ? or fsm ?
}
