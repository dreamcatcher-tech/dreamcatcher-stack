import assert from 'assert-fast'
import { AsyncTrail } from '.'
import { IpldStruct } from './IpldStruct'

export class Pending extends IpldStruct {
  trails = []
  static create() {
    return new Pending()
  }
  addTrail(trail) {
    assert(trail instanceof AsyncTrail)
    const trails = [...this.trails, trail]
    return this.setMap({ trails })
  }
}
