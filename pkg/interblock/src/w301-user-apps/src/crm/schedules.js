import { collection } from '../../../w212-system-covenants'
import dayjs from 'dayjs'
import Debug from 'debug'
const debug = Debug('crm:schedules')
const manifestApi = {
  freeze: {
    type: 'object',
    title: 'FREEZE',
    description: `Takes the current list of customers, takes a snapshot, and stores it in a child.  This will allow the manifest to be printed, and then reconciled.  It may be undispatched`,
  },
  // rm covers removing the manifest
  // rm is blocked if it has been reconciled
  reconcile: {
    description: `modify the reconciled state of the manifest.  May be performed multiple times before finalization`,
  },
  finalize: {
    description: `Manifest is fully reconciled, so send out the emails to people, and deduct money from account balances`,
  },
}

const manifestRowTemplate = {
  title: 'Manifest Row',
  description: `A single row in the manifest`,
  type: 'object',
  required: [
    'id',
    'address',
    'isDone',
    'ebc',
    'nabc',
    'isGateLocked',
    'isFenced',
    'isDog',
    'isVehicleBlocking',
  ],
  additionalProperties: false,
  properties: {
    id: { type: 'string', title: 'Customer #' },
    address: { type: 'string', title: 'Address' },
    isInvoice: { type: 'boolean', title: 'Invoice' },
    type: { type: 'string', title: 'Type', enum: ['Bin', 'Bag'] },
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
    notes: {
      type: 'string',
      title: 'Notes',
      description: 'Any notes about the customer',
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
    additionalProperties: false,
    properties: {
      runDate: { type: 'string', format: 'date' },
      publishedDate: { type: 'string', format: 'date-time' },
      reconciledDate: { type: 'string', format: 'date-time' },
    },
  },
  namePath: 'runDate',
}

const installer = {
  state: {
    type: 'COLLECTION',
    template,
  },
}

const reducer = async (request) => {
  const { type, payload } = request
  switch (type) {
    case 'ADD': {
      // make sure we have a runDate - check schema format
      const { runDate, publishedDate = dayjs().format() } = payload.formData

      // filter out the sectors on this day
      // for each sector, filter out the customers on this day
      // check that all customers are valid - have all been routed.
      // for each customer, create a row

      // set the publishedDate
      // make a payload with network attachments
      const formData = { runDate, publishedDate }
      // in the manifest, hold two hardlinks to the current customers and routing

      const superRequest = { ...request, payload: { formData } }

      return await collection.reducer(superRequest)
    }
    default:
      return collection.reducer(request)
  }
}

const { api } = collection
const name = 'Schedules'
export { name, reducer, api, installer }
