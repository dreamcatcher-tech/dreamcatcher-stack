/**
 * The top level ORM object.
 * Assembles an Engine with all the services it needs to operate.
 * Wraps engine with useful functions for devs.
 * Loads the shell to be loaded at the root block.
 * Works with paths, whereas engine works with addresses.
 * Manages subscriptions to chains for view purposes only.
 */
export class Interblock {
  #engine // does the raw interactions with the model system
  static createCI() {
    // use ram versions of all services
  }
  constructor({ isolate, crypto, persist, scale, announce }) {
    // make a new engine instance using the supplied services, or defaults
  }
  #init() {
    // create the root chain if not present already
  }
  subscribe(callback, path = '/') {
    // call with event type, then data.  PENDING, RESOLVED, REJECTED ?
    // allow to use for subscribing to pending status of the root chain
  }
  actions(path = '/') {
    // get all the actions available at a particular path, as functions
  }
  async getState(path = '.') {
    // with no relative height param, return the latest height
  }
  set logging(isOn = false) {
    // turn on or off logging
  }
  shutdown() {
    // stop the ipfs agent from running
    // persist our config down to ipfs storage
  }

  // merge in all the shell actions here
}
