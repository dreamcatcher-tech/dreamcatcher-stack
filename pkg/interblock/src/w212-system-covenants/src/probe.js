/**
 * Stub for the probe covenant, which will eventually
 * exercise the entire system from within.
 */

import Debug from 'debug'
const debug = Debug('interblock:covenants:probe')

const reducer = async (request) => {
  const { type, payload } = request
  debug(`test action: `, type)
  switch (type) {
    case 'PING':
      return { type: 'PONG', payload }
  }
}
const api = {}

export { reducer, api }
