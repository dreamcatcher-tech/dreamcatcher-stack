import { apps, Interpulse } from '../../../../index.mjs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import Debug from 'debug'
import fs from 'fs'
const debug = Debug('tests')

describe('faker', () => {
  test('routing', async () => {
    const { routing } = await import('./index.js')
    expect(routing.length).toEqual(40)

    const engine = await Interpulse.createCI({
      overloads: { '/crm': apps.crm.covenant },
    })
    await engine.add('routing', '/crm/routing')
    debug('routing', routing[0])
    await engine.execute('routing/add', routing[0])
    const sector = await engine.latest('routing/0')
    const state = sector.getState().toJS()
    expect(state.formData).toEqual(routing[0].formData)
    expect(state).toMatchSnapshot()
  })
  test('routing batch', async () => {
    const { routing } = await import('./index.js')
    expect(routing.length).toEqual(40)
    const engine = await Interpulse.createCI({
      overloads: { '/crm': apps.crm.covenant },
    })
    await engine.add('routing', '/crm/routing')
    await engine.execute('routing/batch', { batch: routing })
    let index = 0
    for (const { formData } of routing) {
      const sector = await engine.latest(`routing/${index}`)
      const state = sector.getState().toJS()
      expect(state.formData).toEqual(formData)
      index++
    }
  })
})

describe.skip('generators', () => {
  // TODO generate using the installer, then add new customers
  // using a harness

  const write = (complex, filename) => {
    delete complex.tree
    const path = `${__dirname}/${filename}.js`
    fs.writeFileSync(path, 'export default ' + JSON.stringify(complex, null, 2))
  }
  const __dirname = dirname(fileURLToPath(import.meta.url))
  test('small', async () => {
    const { default: faker } = await import('.')
    const complex = faker(100)
    const customers = complex.child('customers')
    expect(customers.network.length).toEqual(100)
    write(complex, 'small')
  })
  test('medium', async () => {
    const { default: faker } = await import('.')
    const complex = faker(1000)
    const customers = complex.child('customers')
    expect(customers.network.length).toEqual(1000)
    write(complex, 'medium')
  })
  test('large', async () => {
    const { default: faker } = await import('.')
    const complex = faker(20000)
    const customers = complex.child('customers')
    expect(customers.network.length).toEqual(20000)
    write(complex, 'large')
  })
})
