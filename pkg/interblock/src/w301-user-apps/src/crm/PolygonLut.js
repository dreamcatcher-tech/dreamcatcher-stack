import PolygonLookup from 'polygon-lookup'
import assert from 'assert-fast'
import { encode } from '../../../w008-ipld'

export class PolygonLut {
  #geojson
  #hash
  #sectors
  #changes = {}
  #lookup
  #geometryMap = new Map()
  #unassigned = []
  static create(sectors) {
    assert.strictEqual(typeof sectors, 'object')
    const lut = new PolygonLut()
    lut.#sectors = sectors
    const features = Object.keys(sectors).map((key) => {
      const sector = sectors[key]
      lut.#geometryMap.set(sector.geometry, key)
      return sector.geometry
    })
    lut.#geojson = {
      type: 'FeatureCollection',
      features,
    }
    lut.#lookup = new PolygonLookup(lut.#geojson)
    return lut
  }
  update(custNo, { latitude, longitude }) {
    assert.strictEqual(typeof custNo, 'string')
    assert.strictEqual(typeof latitude, 'number')
    assert.strictEqual(typeof longitude, 'number')
    const result = this.#lookup.search(longitude, latitude)
    if (result) {
      const key = this.#geometryMap.get(result)
      const sector = this.#changes[key] || this.#sectors[key]
      const order = sector.order || []
      if (!order.includes(custNo)) {
        this.#changes[key] = { ...sector, order: [...order, custNo] }
      }
    } else {
      this.#unassigned.push(custNo)
    }
  }
  reset() {
    // all the sectors now go to zero order
    assert(Object.keys(this.#changes).length === 0)
    for (const key in this.#sectors) {
      const sector = this.#sectors[key]
      if (sector.order?.length) {
        this.#changes[key] = { ...sector }
        delete this.#changes[key].order
      }
    }
  }
  get changes() {
    // return only the sectors that have been altered
    return { ...this.#changes }
  }
  get unassigned() {
    return [...this.#unassigned]
  }
  async hash() {
    if (!this.#hash) {
      const block = await encode(this.#geojson)
      this.#hash = block.cid.toString()
    }
    return this.#hash
  }
  get bounds() {
    const { minX, minY, maxX, maxY } = this.#lookup.rtree.data
    return { minX, minY, maxX, maxY }
  }
  includes({ latitude, longitude }) {
    return this.#lookup.search(longitude, latitude)
  }
}
