import collect from 'ipld-schema/bin/collect-input.js'
import { parse } from 'ipld-schema'
import { writeFileSync } from 'fs'
import Debug from 'debug'
const debug = Debug('interblock:schemas')
Debug.enable('interblock:schemas')
const run = async () => {
  const mdPath = './src/w006-schemas/IpldSchemas.md'
  const input = await collect([mdPath])
  debug('generating schema from: ', mdPath)
  const js = parse(input[0].contents)
  //   debug('generated schema: %O', js)
  console.dir(js, { depth: Infinity })
  const json = JSON.stringify(js, null, 2)
  const string = `export default ${json}`
  writeFileSync('./src/w006-schemas/ipldSchemas.js', string)
}

run()
