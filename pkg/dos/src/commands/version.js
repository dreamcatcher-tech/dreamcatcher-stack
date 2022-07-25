import pkg from '../../package.json' assert { type: 'json' }

export const version = () => {
  return { out: `v${pkg.version}` }
}
