import { interchain, usePulse } from '../../w002-api'
import { Address, Request } from '../../w008-ipld'

export const mountReducer = async (payload) => {
  const { chainId, name } = payload
  // TODO warning timing issues if multiple mtab requests made in same pulse
  try {
    await usePulse('/.mtab')
  } catch (error) {
    if (error.message !== 'Segment not present: /.mtab of: /.mtab') {
      throw error
    }
    await interchain(Request.createSpawn('.mtab'))
  }
  const hardlink = Request.createHardlink(name, chainId)
  return await interchain(hardlink, '.mtab')
}
