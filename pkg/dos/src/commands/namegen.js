import dockerNames from 'docker-names'
import Debug from 'debug'
const debug = Debug('dos:commands:namegen')

export const namegen = async ({ spinner, blockchain }, count = 1) => {
  // TODO handle nested and remote paths
  debug(`count: %O`, count)
  let out = ``
  while (count > 0) {
    out += dockerNames.getRandomName()
    count--
    if (count > 0) {
      out += `\n`
    }
  }

  return {
    out,
  }
}

const help = `
Generate a random name, which can be used as an identity for anything.
`
