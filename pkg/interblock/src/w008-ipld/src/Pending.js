import assert from 'assert-fast'
import { AsyncTrail, RxReply } from '.'
import { IpldStruct } from './IpldStruct'

export class Pending extends IpldStruct {
  // blockBuster // the AsyncTrail that caused the block to restart
  system = []
  reducer = []
  static create() {
    return new Pending()
  }
  addTrail(trail) {
    assert(trail instanceof AsyncTrail)
    assert(!trail.pulse)
    assert(!this.system.some((t) => t.isSameOrigin(trail)))
    assert(!this.system.some((t) => t.isSameOrigin(trail)))
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
    for (const trail of this.system) {
      if (trail.hasTx(rxReply)) {
        return trail
      }
    }
    for (const trail of this.reducer) {
      if (trail.hasTx(rxReply)) {
        return trail
      }
    }
  }
  updateTrail(trail) {
    // TODO assert the trail has been updated in some way
    assert(trail instanceof AsyncTrail)
    assert(!trail.pulse)
    if (trail.isSystem()) {
      const system = update(this.system, trail)
      return this.setMap({ system })
    } else {
      const reducer = update(this.reducer, trail)
      return this.setMap({ reducer })
    }
  }
}

const update = (trailArray, trail) => {
  assert(Array.isArray(trailArray))
  const index = trailArray.findIndex((t) => t.isSameOrigin(trail))
  assert(trailArray[index])
  const updated = [...trailArray]
  if (trail.isSettled()) {
    updated.splice(index, 1)
  } else {
    updated[index] = trail
  }
  return updated
}
