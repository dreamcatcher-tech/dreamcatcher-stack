import Debug from 'debug'
import { useState } from '../../../w002-api'
import { COLORS } from './utils'
const debug = Debug('crm:manifest')

export const api = {}

const Run = {
  type: 'DATUM',
  schema: {
    title: 'Run',
    description: `A Run is a colleciton customers that are
      scheduled for service on the runDate.  Runs include modifications
      due to holidays and other day specific events, such as truck
      malfunctions`,
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

export const installer = {}
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
