import Debug from 'debug'
const debug = Debug('interblock:engine:Scale')
export class Scale {
  // fires up more engine instances to form a distributed engine
  // in a trusted environment such as multicore cpu or aws lambda
  watchdog(lock) {
    // notify the watchdog whenever lock is aquired, or lock was taken
    // watchdog is responsible for continuity of operations.
    // may be superseded by running multiple engines
    debug('watchdog')
    // TODO watchdog and lock should be the same
  }
}
