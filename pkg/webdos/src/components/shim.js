import * as L from 'leaflet'
if (!globalThis.L) {
  globalThis.L = { ...L }
}
