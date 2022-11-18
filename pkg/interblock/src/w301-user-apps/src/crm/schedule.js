const api = {
  freeze: {
    type: 'object',
    title: 'DISPATCH',
    description: `Takes the current list of customers, takes a snapshot, and stores it in a child.  This will allow the manifest to be printed, and then reconciled.  It may be undispatched`,
  },
  // rm covers removing the manifest
  // rm is blocked if it has been reconciled
  reconcile: {
    description: `modify the reconciled state of the manifest.  May be performed multiple times before finalization`,
  },
  finalize: {
    description: `Manifest is fully reconciled, send out the emails to people, and deduct money from account balances`,
  },
}

const manifestRowTemplate = {
  title: 'Manifest Row',
  description: `A single row in the manifest`,
  type: 'object',
  required: [
    'id',
    'isDone',
    'ebc',
    'nabc',
    'isGateLocked',
    'isFenced',
    'isDog',
    'isVehicleBlocking',
  ],
  allowAdditionalProperties: false,
  properties: {
    id: { type: 'string' },
    isDone: { type: 'boolean', title: 'Done', default: false },
    ebc: { type: 'boolean', title: 'EBC' },
    nabc: { type: 'boolean', title: 'NABC' },
    isGateLocked: { type: 'boolean', title: 'Gate' },
    isFenced: { type: 'boolean', title: 'Fence' },
    isDog: {
      type: 'boolean',
      title: 'Dog',
      description: 'is there a dog stopping collection?',
    },
    isVehicleBlocking: {
      type: 'boolean',
      title: 'Vehicle',
      description: 'Is there a vehicle blocking the gate?',
    },
    deliveredBin: {
      type: 'string',
      title: 'Delivered Bin',
      description: 'The ID of the bin that was delivered',
    },
    canceledBin: {
      type: 'string',
      title: 'Cancelled Bin',
      description: 'The ID of the bin that was returned',
    },
  },
}

const template = {
  type: 'COLLECTION',
  schema: {
    title: 'Manifest',
    description: `A manifest is a list of customers that are to be serviced on a given day`,
    type: 'object',
    required: ['runDate'],
    allowAdditionalProperties: false,
    properties: {
      runDate: { type: 'string', format: 'date' },
      isPublished: { type: 'boolean' },
      isReconciled: { type: 'boolean' },
    },
  },
  template: {
    schema: {
      title: 'Sector Manifest',
      type: 'object',
      description: `Scheduled collections, in order, for a given sector`,
      additionalProperties: false,
      properties: {
        rows: {
          type: 'array',
          definition: `Scheduled collections, in order`,
          items: manifestRowTemplate,
        },
      },
    },
    uiSchema: {
      id: { 'ui:widget': 'hidden' },
    },
  },
}

export const installer = {
  covenant: 'datum',
  state: {
    type: 'COLLECTION',
    template,
  },
}
// TODO make a network hardlink to approot at time of creation
