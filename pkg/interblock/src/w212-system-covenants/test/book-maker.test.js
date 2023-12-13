import { Interpulse, apps } from '../..'
import { makeBook } from '../src/book-maker'
import dotenv from 'dotenv'
import Debug from 'debug'
const debug = Debug('tests')
dotenv.config({ path: '../../.env' })

describe('book-maker', () => {
  it('makes a book', async () => {
    const reducer = async (request) => {
      if (request.type === 'MAKER') {
        const book = await makeBook('/')
        return book
      }
    }
    const engine = await Interpulse.createCI({
      overloads: { '/apps/crm': apps.crm.covenant, '/book': { reducer } },
    })
    // Debug.enable('iplog tests *book-maker')
    await engine.add('crm', { covenant: '/apps/crm' })
    await engine.add('book-maker', { covenant: '/book' })
    const book = await engine.dispatch(
      { type: 'MAKER', payload: {} },
      'book-maker'
    )
    debug('result', book.children.crm)
  })
})

// format of the book should be path then the description then the api
// make a tool that auto checks that the description and api match
// both ways.
