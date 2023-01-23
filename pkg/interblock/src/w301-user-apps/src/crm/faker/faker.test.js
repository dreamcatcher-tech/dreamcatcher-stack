import { dirname } from 'path'
import { fileURLToPath } from 'url'
import Debug from 'debug'
import fs from 'fs'
const debug = Debug('test')
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
