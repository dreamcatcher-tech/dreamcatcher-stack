import assert from 'assert-fast'
import { collection } from '../../../w212-system-covenants'
import { COLORS } from './utils'
import { interchain, usePulse, useState } from '../../../w002-api'
import Debug from 'debug'
import { PolygonLut } from './PolygonLut'
const debug = Debug('crm:routing')

const geometry = {
  type: 'object',
  required: ['type', 'properties', 'geometry'],
  properties: {
    type: { const: 'Feature' },
    properties: { type: 'object', maxProperties: 0 },
    geometry: {
      title: 'GeoJSON Polygon',
      type: 'object',
      required: ['type', 'coordinates'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          const: 'Polygon',
        },
        coordinates: {
          type: 'array',
          items: {
            type: 'array',
            minItems: 4,
            items: {
              type: 'array',
              minItems: 2,
              items: {
                type: 'number',
              },
            },
          },
        },
      },
    },
  },
}
const template = {
  type: 'DATUM',
  schema: {
    title: 'Sector',
    description: `A sector is a geographic area that is used to group customers 
        for scheduling purposes.`,
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
      frequencyInDays: { type: 'integer', title: 'Frequency in Days' },
      frequencyOffset: { type: 'integer', title: 'Frequency Offset' },
      geometry,
      order: {
        type: 'array',
        title: 'Order',
        uniqueItems: true,
        items: { type: 'string' },
        default: [],
      },
      unapproved: {
        type: 'array',
        title: 'Unapproved',
        uniqueItems: true,
        items: { type: 'string' },
        default: [],
      },
    },
  },
  uiSchema: {
    geometry: { 'ui:widget': 'hidden' },
    order: { 'ui:widget': 'hidden' },
    unapproved: { 'ui:widget': 'hidden' },
  },
}

/**
 * Create a "universal sector" which is used to set the zoom boundary of the app.
 * All sectors are within this, and all customers too.
 * It has order of customers, but this order can never be set.
 * Whenever geometry changes, membership is checked against intersections,
 * past intersections, and the universal set.
 */

const installer = {
  state: {
    type: 'COLLECTION',
    schema: {
      title: 'Routing',
      description: `Routing manages geographic boundaries to group customers
      together for service by a truck, and the order of all the customers`,
      type: 'object',
      required: ['commonDate'],
      properties: {
        commonDate: {
          type: 'string',
          description: `The date that all sectors share in common`,
          format: 'date',
        },
        geometryHash: {
          type: 'string',
          description: `Hash of the geometry to know if the sectors need recomputing`,
        },
        unassigned: {
          type: 'array',
          title: 'Unassigned',
          description: `Customers that are not assigned to any sector`,
          uniqueItems: true,
          items: { type: 'string' },
          default: [],
        },
      },
    },
    uiSchema: {
      geometryHash: { 'ui:widget': 'hidden' },
    },
    formData: {
      commonDate: '2017-01-30',
    },
    template,
  },
}
const api = {
  ...collection.api,
  update: {
    type: 'object',
    title: 'UPDATE',
    description: `Something in the customers collection has changed,
    and so the memberships in each sector should be recomputed.
    To avoid a lot of updates, this calculation is done at the root first,
    then only when differences are detected is the update action triggered
    in routing.`,
    additionalProperties: false,
    properties: {
      path: {
        type: 'string',
        title: 'Path to Customers collection',
        default: '../customers',
      },
    },
  },
  approve: {
    // TODO move this to be in the sector directly
    type: 'object',
    title: 'APPROVE',
    description: `Approve the given customer ids for this sector`,
    required: ['sectorId'],
    additionalProperties: false,
    properties: {
      sectorId: {
        type: 'string',
        title: 'Sector Id',
        description: `The sector id to approve customers for.
        Will be removed once collections of covenants can be used`,
      },
      approved: {
        type: 'array',
        title: 'Approved',
        uniqueItems: true,
        items: { type: 'string' },
        minItems: 1,
        description: `The customer ids to approve, which must be
            currently unapproved`,
      },
      approveAll: {
        type: 'boolean',
        title: 'Approve All',
        description: `Approve all unapproved customers`,
      },
    },
  },
}
const name = 'Routing'

const reducer = async (request) => {
  const { type, payload } = request
  switch (type) {
    case '_SECTORS': {
      const routing = await usePulse()
      const sectors = await routing.getNetwork().children.allKeys()
      // TODO assure the sort order is based on numbers, not strings
      debug('sector keys', sectors)
      return sectors
    }
    case '_CUSTOMERS': {
      const { path, isSectorsChanged } = payload
      const customers = await usePulse(path)
      let custNos
      if (isSectorsChanged) {
        custNos = await customers.getNetwork().children.allKeys()
      } else {
        // TODO diff the customers and run them
        custNos = await customers.getNetwork().children.allKeys()
      }
      return custNos
    }
    case 'UPDATE': {
      // read all the sectors, and check if they have changed since last compute.
      // if sectors changed, then need to recompute all memberships
      const sectorKeys = await interchain('_SECTORS')
      // TODO assure the sort order is based on numbers, not strings
      debug('sector keys', sectorKeys)
      const sectors = {}
      const setStates = {}
      await Promise.all(
        sectorKeys.map(async (path) => {
          const [state, setState] = await useState(path)
          sectors[path] = state
          setStates[path] = [state, setState]
        })
      )
      const lut = PolygonLut.create(sectors)
      debug('begin')
      const hash = await lut.hash()
      const [state, setState] = await useState()
      const isSectorsChanged = state.geometryHash !== hash
      debug('isSectorsChanged', isSectorsChanged)
      if (isSectorsChanged) {
        lut.reset()
      }

      const { path = '../customers' } = payload
      debug('update', path)
      const cPayload = { path, isSectorsChanged }
      const custNos = await interchain('_CUSTOMERS', cPayload)

      await Promise.all(
        custNos.map(async (custNo) => {
          const [state] = await useState(path + '/' + custNo)
          const gps = state.serviceGps
          if (!gps) {
            debug('no gps', custNo, state)
          }
          lut.update(custNo, gps)
        })
      )
      // TODO store the customer collection as a hardlink, for diffing
      await Promise.all(
        Object.entries(lut.changes).map(async ([changedKey, changes]) => {
          const [, setState] = setStates[changedKey]
          assert.strictEqual(typeof setState, 'function')
          debug('update order', changedKey)
          await setState(changes)
        })
      )
      let { unassigned = [] } = state
      unassigned = [...unassigned, ...lut.unassigned]
      await setState({ geometryHash: hash, unassigned })
      return
    }
    case 'APPROVE': {
      const { sectorId, approved, approveAll } = payload
      if (!approveAll) {
        assert(approved, `Must provide one of approved or approveAll`)
      }
      if (approveAll) {
        assert(!approved, `Cannot provide approved and approveAll`)
      }
      debug('approve', sectorId, approved, approveAll)
      const [state, setState] = await useState(sectorId)
      const unapproved = new Set(state.unapproved || [])
      const toApprove = approveAll ? state.unapproved : approved
      toApprove.forEach((custNo) => {
        if (!unapproved.has(custNo)) {
          throw new Error(`Tried to approve missing customer: ${custNo}`)
        }
        unapproved.delete(custNo)
      })
      debug('unapproved', unapproved)
      // TODO remove the need for replace if we send in a key with undefined
      await setState(
        { unapproved: unapproved.size ? [...unapproved] : undefined },
        { replace: true }
      )
      return
    }
    default:
      return collection.reducer(request)
  }
}
export { name, reducer, api, installer }
