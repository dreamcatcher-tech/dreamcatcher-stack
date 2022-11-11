import 'leaflet/dist/leaflet.css'
import * as Leaflet from 'leaflet'
const L = { ...Leaflet }
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

L.PM.setOptIn(true)

// import 'leaflet-draw/dist/leaflet.draw.css'
// import 'leaflet-draw/dist/leaflet.draw-src'

// import 'leaflet-providers'

// import 'leaflet.markercluster/dist/MarkerCluster.css'
// import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
// import 'leaflet.markercluster'

import 'beautifymarker/leaflet-beautify-marker-icon.css'
import 'beautifymarker'
console.log('L', L)
export default L
