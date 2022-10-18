import Debug from 'debug'
import assert from 'assert-fast'
import { LicenseInfo } from '@mui/x-license-pro'
LicenseInfo.setLicenseKey(
  '61628ce74db2c1b62783a6d438593bc5Tz1NVUktRG9jLEU9MTY4MzQ0NzgyMTI4NCxTPXByZW1pdW0sTE09c3Vic2NyaXB0aW9uLEtWPTI='
)
const debug = Debug('web-components:utils')

export const getNextPath = (path, cwd) => {
  assert.strictEqual(typeof path, 'string', `Invalid path: ${path}`)
  assert.strictEqual(typeof cwd, 'string', `Invalid cwd: ${cwd}`)
  const segments = getPathSegments(path)
  assert(segments.includes(cwd), `invalid cwd: ${cwd}`)
  while (segments[0] !== cwd) {
    segments.shift()
  }
  segments.shift()
  const nextPath = segments.shift()
  debug(`nextPath`, nextPath)
  return nextPath
}
export const getPathSegments = (alias) => {
  // TODO merge with metrologyFactory function
  if (alias === '/') {
    return ['/']
  }
  let prefix = ''
  const splits = alias.split('/').filter((seg) => !!seg)
  splits.unshift('/')
  const paths = splits.map((segment) => {
    prefix && prefix !== '/' && (prefix += '/') // TODO make child naming convention avoid this check ?
    prefix += segment
    return prefix
  })
  return paths
}
export const splitPathSegments = (path) => {
  // TODO merge with metrologyFactory function
  if (path === '/') {
    return ['/']
  }
  const paths = path.split('/').filter((seg) => !!seg)
  paths.unshift('/')
  return paths
}
