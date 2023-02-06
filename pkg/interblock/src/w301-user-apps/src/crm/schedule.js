import { Request } from '../../../w008-ipld'
import { interchain } from '../../../w002-api'
import * as run from './run'
import { useState } from '../../../w002-api'
import Debug from 'debug'
const debug = Debug('crm:schedules:schedule')

export const api = {
  schedule: {
    type: 'object',
    title: 'SCHEDULE',
    description: `Create Runs for each Sector for the given day`,
    required: ['runDate', 'sectors', 'routing', 'customers'],
    additionalProperties: false,
    properties: {
      runDate: { type: 'string', format: 'date' },
      sectors: { type: 'array', items: { type: 'string' } },
      routing: {
        type: 'string',
        description: `Path to the routing collection`,
      },
      customers: {
        type: 'string',
        description: `Path to the customers collection`,
      },
    },
  },
}

export const reducer = async (request) => {
  const { type } = request
  switch (type) {
    case '@@INIT': {
      const [state] = await useState()
      const { runDate, sectors, routing, customers } = state
      debug(type, runDate, sectors, routing, customers)

      await Promise.all(
        sectors.map(async (sectorId) => {
          debug('creating manifest for', sectorId)
          const [state] = await useState(routing + '/' + sectorId)
          const { name, color, order = [] } = state.formData
          const run = { name, color, order, runDate }
          return addRun(sectorId, run, customers)
        })
      )
      return
    }
    default: {
      throw new Error(`Unknown type: ${type}`)
    }
  }
}

export const installer = {
  // TODO add schema for state
}
export const covenants = { run }

const addRun = async (path, run, customers) => {
  const { name, color, order, runDate } = run
  debug('addRun', path, name)
  const state = { formData: { name, color, order, runDate }, customers }
  const covenant = '#/run'
  const installer = { state, covenant }
  const spawn = Request.createSpawn(path, installer)
  const result = await interchain(spawn)
  debug(`datum added`, result.alias)
  return result
}
