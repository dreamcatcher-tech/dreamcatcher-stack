import Debug from 'debug'
import { useState } from '../../../w002-api'
import { COLORS } from './utils'
import * as routing from './routing'
const debug = Debug('crm:manifest')

export const api = {}

/**
 * Ways to present the geometry in a map
 * 1. Make a virtual Crisp that gathers all the sectors.
 * 2. Make hardlinks to the sectors, and gather them into a virtual Crisp.
 * 3. Make runs be separate from the geometry for runs, and they instead
 * point at the sector snapshot they represent.
 * 4. Copy the geomtry in to each run directly
 * 5. Make sectors store the geometry as children, or somewhere else
 * so that schedules can refer to them directly
 * 6. schedule store a child that holds all the geometry as hardlinks
 * runs hold the same sectorId as each of these items
 * the geometry is dropped into the map directly
 * 7. a run is a fork of the sector, and the geometry is in history
 * geometry is stored in history, and so a crisp is built up from the
 * moment before the mutation, to reference the geometry
 * 8. hardlink to routing, then calculate valid sectors on the fly
 * 9. fork the routing chain, removing all sectors that are not valid.
 */

const state = {
  type: 'DATUM',
  schema: {
    // TODO redefine as a mutation on the sector schema
    title: 'Run',
    description: `A Run is a colleciton customers that are
      scheduled for service on the runDate within a specific sector.
      Runs include modifications due to holidays and other day specific 
      events, such as truck malfunctions`,
    type: 'object',
    required: ['name', 'color', 'geometry'],
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
      geometry: routing.installer.state.template.schema.properties.geometry,
      order: {
        type: 'array',
        title: 'Order',
        description: `The subset of the order array that is scheduled
        for this runDate`,
        uniqueItems: true,
        items: { type: 'string' },
        default: [],
      },
      added: {
        type: 'array',
        title: 'Added',
        uniqueItems: true,
        items: { type: 'string' },
      },
      removed: {
        type: 'array',
        title: 'Removed',
        uniqueItems: true,
        items: { type: 'string' },
      },
      moved: {
        type: 'array',
        title: 'Moved',
        uniqueItems: true,
        items: { type: 'string' },
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

export const installer = { state }
export const name = 'Run'
export const reducer = async (request) => {
  const { type, payload } = request
  switch (type) {
    case '@@INIT': {
      const [state, setState] = await useState()
      // TODO check the schema
      const { formData, customers } = state
      const { order: original = [], runDate } = formData
      const order = []
      await Promise.all(
        original.map(async (customerId) => {
          const [{ formData }] = await useState(`${customers}/${customerId}`)
          debug('customer', formData)
          // get out the customer subscriptions
          // check if anything is due today
          // if so, add to scheduled
          order.push(customerId)
        })
      )
      await setState({ ...state, formData: { ...formData, order } })
      return
    }
    default: {
      throw new Error(`Unknown type: ${type}`)
    }
  }
}
