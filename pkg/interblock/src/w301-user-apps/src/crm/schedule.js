import { interchain, usePulse, useState } from '../../../w002-api'
import { isSectorOnDate, COLORS } from './utils'
import { collection } from '../../../w212-system-covenants'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('crm:schedule')
const manifestApi = {
  schedule: {
    type: 'object',
    title: 'SCHEDULE',
    description: `Write to all customers that they will be scheduled today.
    Links the customer transactions back to this schedule for ease of lookups.`,
    properties: {
      customers: { type: 'array', items: { type: 'string' } },
      all: { type: 'boolean' },
    },
  },
  // rm covers removing the manifest
  // rm is blocked if it has been reconciled

  finalize: {
    description: `Manifest is fully reconciled, so send out the emails to people, and deduct money from account balances`,
  },
}

const transaction = {
  type: 'DATUM',
  schema: {
    title: 'Transaction',
    description: `A transaction is a record of a service attempt to 
  a customer`,
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
      runDate: { type: 'string', format: 'date' },
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
  },
  namePath: 'runDate',
  uiSchema: {
    order: { 'ui:widget': 'hidden' },
    added: { 'ui:widget': 'hidden' },
    removed: { 'ui:widget': 'hidden' },
    moved: { 'ui:widget': 'hidden' },
  },
}

const manifest = {
  type: 'DATUM',
  schema: {
    title: 'Manifest',
    description: `A manifest is a colleciton customers that are
    scheduled for a particular day.`,
    type: 'object',
    required: ['name', 'color'],
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        title: 'Name',
        description: 'The name of the sector',
      },
      color: {
        title: 'Color',
        description: 'The color of the sector',
        enum: COLORS,
      },
      order: {
        type: 'array',
        title: 'Order',
        uniqueItems: true,
        items: { type: 'string' },
        default: [],
      },
      added: {
        type: 'array',
        title: 'Added',
        uniqueItems: true,
        items: { type: 'string' },
        default: [],
      },
      removed: {
        type: 'array',
        title: 'Removed',
        uniqueItems: true,
        items: { type: 'string' },
        default: [],
      },
      moved: {
        type: 'array',
        title: 'Moved',
        uniqueItems: true,
        items: { type: 'string' },
        default: [],
      },
    },
  },
  namePath: 'runDate',
  uiSchema: {
    order: { 'ui:widget': 'hidden' },
    added: { 'ui:widget': 'hidden' },
    removed: { 'ui:widget': 'hidden' },
    moved: { 'ui:widget': 'hidden' },
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

const api = {
  ...collection.api,
  create: {
    type: 'object',
    title: 'CREATE',
    description: `Create a new Schedule for a particular day, taking a
    snapshot of the current routing sectors and order within.
    Reject this call if some customers for the day have not been approved.
    Cannot do any scheduling for a day without doing this first.
    Customers can mutate after this point, but sectors cannot.
    Unapproved customers added after are detected by the UI.
    Further operations are blocked if new unapproved customers are added.`,
    required: ['runDate'],
    additionalProperties: false,
    properties: {
      runDate: { type: 'string', format: 'date' },
      path: { type: 'string', description: `Path to the routing collection` },
    },
  },
  publish: {
    type: 'object',
    title: 'PUBLISH',
    description: ``,
    properties: {
      customers: { type: 'array', items: { type: 'string' } },
      all: {
        type: 'boolean',
        description: `All customers fetched by this query at this moment will be published.`,
      },
    },
  },
}

const reducer = async (request) => {
  const { type, payload } = request
  switch (type) {
    case 'ADD':
      throw new Error('use CREATE to add a new schedule')
    case '_SECTOR-IDS': {
      const { path } = payload
      const pulse = await usePulse(path)
      const childrenHamt = pulse.getNetwork().children
      const sectorIds = await childrenHamt.allKeys()
      return { sectorIds }
    }
    case 'CREATE': {
      // make sure we have a runDate - check schema format
      const { runDate, path } = payload
      debug('CREATE', runDate, path)
      const { sectorIds } = await interchain('_SECTOR-IDS', { path })
      assert(Array.isArray(sectorIds), 'sectorIds must be an array')
      debug('SECTOR-IDS', sectorIds)

      const sectors = {}
      const [routingState] = await useState(path)
      const { commonDate } = routingState.formData
      debug('commonDate', commonDate)
      await Promise.all(
        sectorIds.map(async (sectorId) => {
          const [state] = await useState(path + '/' + sectorId)
          const sector = state.formData
          debug('sector', sector)
          if (isSectorOnDate(sector, commonDate, runDate)) {
            if (sector?.unapproved.length) {
              const count = sector.unapproved.length
              throw new Error(
                `Sector ${sectorId}: "${sector.name}" has ${count} unapproved customers`
              )
            }
            sectors[sectorId] = sector
          }
        })
      )
      debug('sectors', sectors)

      // filter out the sectors on this day
      // create a child called a manifest that has a hardlink to the sectors
      // in this object, store the additions and removals

      // for each sector, filter out the customers on this day
      // check that all customers are valid - have all been routed.
      // for each customer, create a row

      // set the publishedDate
      // make a payload with network attachments
      const formData = { runDate }
      // in the manifest, hold two hardlinks to the current customers and routing

      const superRequest = { type: 'ADD', payload: { formData } }

      // fork all the sectors, by using links to them, based on their
      // frequency and the runDate, using hardlinks to snapshot.

      return await collection.reducer(superRequest)
    }
    default:
      return collection.reducer(request)
  }
}

const name = 'Schedule'
export { name, reducer, api, installer }
