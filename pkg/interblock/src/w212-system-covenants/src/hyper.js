/**
 * The hypercomputer.
 * At the base of AWS is the first hypercomputer.
 * To connect, you join with the authenticator, then expand your permissions.
 * This will grant you a terminal, which you can use to start your own hypercomputer.
 *
 * Hypercomputers are recursive, and they can be reprogrammed with an application.
 *
 * Structure:
 *
 * /
 *      authenticator / firewall
 *      terminals
 *      filesApp
 *      someOtherApp
 *      hypercomputers
 *          hyper1
 *          hyper2
 */
import Debug from 'debug'
const debug = Debug('interblock:covenants:hyper')

const reducer = async (request) => {
  debug(`hyper action: `, request)
  const { type, payload } = request
  switch (type) {
    case 'PING':
      return { type: 'PONG', payload }
  }
}
const api = {}

export { reducer, api }
