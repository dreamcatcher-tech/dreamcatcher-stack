import { crm } from '../../w301-user-apps'
import { Isolate } from '../src/Isolate'
import Debug from 'debug'
const debug = Debug('tests')

describe('Isolate', () => {
  test('single level nested overload', async () => {
    const overloads = { '/crm': crm.covenant }
    expect(crm.covenant.covenants).toBeDefined()
    const expanded = Isolate.extractOverloads(overloads)
    debug('expanded', expanded)
    expect(expanded['/crm']).toBeDefined()
    for (const key of Object.keys(crm.covenant.covenants)) {
      expect(expanded['/crm/' + key]).toBeDefined()
    }
    const covenantsSize = Object.keys(crm.covenant.covenants).length
    expect(Object.keys(expanded).length).toBe(covenantsSize + 1)
  })
})
