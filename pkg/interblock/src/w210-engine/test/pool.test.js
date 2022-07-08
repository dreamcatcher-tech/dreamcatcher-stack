import Debug from 'debug'
const debug = Debug('interblock:tests:pool')

describe('pool', () => {
  test.todo('softpulse is locked')
  /**
   * while blocking, should buffer still, and await the pulse completion
   *
   * pulse changes come only from pierce or interpulse updates
   * first read the pulse, see if you have a valid modification to make
   * if believe valid, lock and read the pulse
   * check again if your mod is valid, then proceed with the mod
   *
   * increase() calls can only come after the pulse has been locked and updated.
   * the lock for soft should be the same as for pulse, as no need to release.
   *
   * if pool is updated remotely, we need a catchup / tear function
   * if pulse is updated remotely, we need a catchup / tear function
   */
  test.todo('already included interpulses are dropped')
  test.todo('connection attempt makes it thru')
  test.todo('connection denied for chain that is not listening')
  test.todo('connection ignored by receiver if chain already connected')
  test.todo('connection not attempted by sender if chain already connected')
})
