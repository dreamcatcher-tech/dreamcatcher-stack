import pkg from '../../package.json'

export const version = () => {
  return { out: `v${pkg.version}` }
}
