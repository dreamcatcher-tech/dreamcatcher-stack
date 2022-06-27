import assert from 'assert-fast'
import { AsyncTrail, RxReply } from '.'
import { IpldStruct } from './IpldStruct'

export class Pending extends IpldStruct {
  system = []
  reducer = []
  static create() {
    return new Pending()
  }
  addTrail(trail) {
    assert(trail instanceof AsyncTrail)
    if (trail.isSystem()) {
      const system = [...this.system, trail]
      return this.setMap({ system })
    } else {
      const reducer = [...this.reducer, trail]
      return this.setMap({ reducer })
    }
  }
  findTrail(rxReply) {
    assert(rxReply instanceof RxReply)
    assert(rxReply.isResolve() || rxReply.isRejection(), 'no promises')
    const array = rxReply.requestId.isSystem() ? this.system : this.reducer
    for (const trail of array) {
      if (trail.hasTx(rxReply)) {
        return trail
      }
    }
  }
  updateTrail(trail) {
    // TODO assert the trail has been updated in some way
    assert(trail instanceof AsyncTrail)
    if (trail.pulse) {
      trail = trail.delete('pulse')
    }
    if (trail.isSystem()) {
      const index = this.system.findIndex((t) => t.isSameOrigin(trail))
      assert(this.system[index])
      const system = [...this.system]
      system[index] = trail
      return this.setMap({ system })
    } else {
      const index = this.reducer.findIndex((t) => t.isSameOrigin(trail))
      assert(this.reducer[index])
      const reducer = [...this.reducer]
      reducer[index] = trail
      return this.setMap({ reducer })
    }
  }
}
