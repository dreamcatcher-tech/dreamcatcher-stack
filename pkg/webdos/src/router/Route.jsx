import assert from 'assert-fast'
import posix from 'path-browserify'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { useRouter, useBlockchain } from '../hooks'

const debug = Debug('webdos:router:Route')
const Route = ({ path, covenant, children }) => {
  debug(`Route path: %s covenant: %s`, path, covenant)
  // path match is when some remains of (cwd - match) === path
  const { matchedPath, pulse } = useRouter()
  assert(posix.isAbsolute(matchedPath), `match not absolute: ${matchedPath}`)
  const { wd } = useBlockchain()

  if (path) {
    let pathTest = path
    if (path.endsWith('*')) {
      // TODO parse globs correctly
      pathTest = path.substring(0, path.length - 1)
    }
    if (wd.includes(pathTest)) {
      return children
    }
  }

  if (covenant) {
    const { covenant: toMatch } = pulse.provenance.dmz
    if (covenant === toMatch) {
      return children
    }
  }
}
Route.propTypes = {
  path: PropTypes.string,
  covenant: PropTypes.string,
  children: PropTypes.node,
}

export default Route
