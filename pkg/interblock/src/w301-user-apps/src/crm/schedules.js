import { Request } from '../../../w008-ipld'
import { interchain, usePulse, useState } from '../../../w002-api'
import { isSectorOnDate, COLORS } from './utils'
import { collection } from '../../../w212-system-covenants'
import * as schedule from './schedule'
import posix from 'path-browserify'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('crm:schedule')

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
      routing: {
        type: 'string',
        description: `Path to the routing collection`,
        default: '../routing',
      },
      customers: {
        type: 'string',
        description: `Path to the customers collection`,
        default: '../customers',
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
      const { routing } = payload
      const pulse = await usePulse(routing)
      const childrenHamt = pulse.getNetwork().children
      const sectorIds = await childrenHamt.allKeys()
      return { sectorIds }
    }
    case 'CREATE': {
      // make sure we have a runDate - check schema format
      const { runDate, routing, customers } = payload
      debug('CREATE', runDate, routing, customers)
      const { sectorIds } = await interchain('_SECTOR-IDS', { routing })
      assert(Array.isArray(sectorIds), 'sectorIds must be an array')
      debug('SECTOR-IDS', sectorIds)

      const sectors = []
      const [routingState] = await useState(routing)
      const { commonDate } = routingState.formData
      debug('commonDate', commonDate)
      await Promise.all(
        sectorIds.map(async (sectorId) => {
          const [state] = await useState(routing + '/' + sectorId)
          const sector = state.formData
          if (isSectorOnDate(sector, commonDate, runDate)) {
            if (sector.unapproved?.length) {
              const msg = `Sector ${sectorId}: "${sector.name}" has ${sector.unapproved.length} unapproved customers`
              throw new Error(msg)
            }
            sectors.push(sectorId)
          }
        })
      )
      debug('sectors', sectors)
      return await addSchedule(runDate, sectors, routing, customers)
    }
    default:
      if (type !== '@@INIT') {
        throw new Error(`Unknown type: ${type}`)
      }
  }
}
const addSchedule = async (runDate, sectors, routing, customers) => {
  if (!posix.isAbsolute(routing)) {
    routing = posix.join('..', routing)
  }
  if (!posix.isAbsolute(customers)) {
    customers = posix.join('..', customers)
  }
  debug('addSchedule', runDate, sectors, routing)
  const covenant = '#/schedule'
  // TODO add schema to the state
  const state = { runDate, sectors, routing, customers }
  const installer = { covenant, state }
  // TODO expose only an api based on the dmz api, no Request import
  const spawn = Request.createSpawn(runDate, installer)
  const spawnResult = await interchain(spawn)
  debug(`datum added`, spawnResult.alias)
  return spawnResult
}

const covenants = { schedule }
const name = 'Schedules'
export { name, reducer, api, installer, covenants }
