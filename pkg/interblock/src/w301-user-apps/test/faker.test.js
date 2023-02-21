import { apps, Interpulse } from '../../index.mjs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import Debug from 'debug'
import fs from 'fs'
const debug = Debug('tests')
const overloads = { '/crm': apps.crm.covenant }

describe('faker', () => {
  describe('routing', () => {
    test('single', async () => {
      const { routing } = await import('../src/crm/faker/index.js')
      const batch = routing.generateBatch()
      expect(batch.length).toEqual(40)

      const engine = await Interpulse.createCI({ overloads })
      await engine.add('routing', '/crm/routing')
      const single = routing.generateSingle()
      await engine.execute('routing/add', single)
      const sector = await engine.latest('routing/0')
      const state = sector.getState().toJS()
      expect(state.formData).toEqual(single.formData)
      expect(state).toMatchSnapshot()
    })
    test('batch', async () => {
      const { routing } = await import('../src/crm/faker/index.js')
      const engine = await Interpulse.createCI({ overloads })
      await engine.add('routing', '/crm/routing')
      const batch = routing.generateBatch()
      await engine.execute('routing/batch', { batch })
      let index = 0
      for (const { formData } of batch) {
        const sector = await engine.latest(`routing/${index}`)
        const state = sector.getState().toJS()
        expect(state.formData).toEqual(formData)
        index++
      }
    })
  })

  describe('customers', () => {
    test('single', async () => {
      const { customers } = await import('../src/crm/faker/index.js')
      const single = customers.generateSingle()
      debug('single', single)

      const engine = await Interpulse.createCI({ overloads })
      await engine.add('customers', '/crm/customers')
      debug('customers', single)
      await engine.execute('customers/add', single)
      const sector = await engine.current('customers/' + single.formData.custNo)
      const state = sector.getState().toJS()
      expect(state.formData).toEqual(single.formData)
      expect(state).toMatchSnapshot()
    })
    test('batch', async () => {
      const { customers } = await import('../src/crm/faker/index.js')
      const batchSize = 11
      const batch = customers.generateBatch(batchSize)
      expect(batch.length).toEqual(batchSize)
      const engine = await Interpulse.createCI({ overloads })
      await engine.add('customers', '/crm/customers')
      await engine.execute('customers/batch', { batch })
      for (const { formData } of batch) {
        const sector = await engine.current(`customers/${formData.custNo}`)
        const state = sector.getState().toJS()
        expect(state.formData).toEqual(formData)
      }
    })
    test('progressive batch', async () => {
      const engine = await Interpulse.createCI({ overloads })
      await engine.add('app', '/crm')
      const { routing, customers } = await import('../src/crm/faker/index.js')
      const allSectors = routing.generateBatch()
      const fullBatch = customers.generateBatchInside(allSectors, 100)
      Debug.enable('tests')
      debug('fake data', fullBatch.length, 'customers')
      let batch = []
      let count = 0
      for (const customer of fullBatch) {
        batch.push(customer)
        if (batch.length % 50 === 0) {
          await engine.execute('/app/customers/batch', { batch })
          count += batch.length
          batch = []
          debug('Fake data added ' + count + ' customers')
        }
      }
    })
  })
})
