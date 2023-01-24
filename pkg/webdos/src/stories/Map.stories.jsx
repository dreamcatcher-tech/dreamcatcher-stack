import React from 'react'
import { Engine, Syncer, Map, Glass } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import sectorsList from '../../../../data/sectors.mjs'

const debug = Debug('Map')

const add = { add: { path: 'routing', installer: '/dpkg/crm/customers' } }

const makeRouting = () => {
  const { list, ...formData } = sectorsList
  const batch = list.map((sector) => {
    const order = []
    return { formData: { ...sector, order } }
  })
  debug('batch', batch)
  return { 'routing/batch': { batch } }
}

export default {
  title: 'Map',
  component: Map,
  args: {
    onCreate: (geoJson) => {
      console.log('create', geoJson)
    },
    onEdit: (geoJson) => {
      console.log('edit', geoJson)
    },
    onSector: (sector) => {
      console.log('sector', sector)
    },
    onMarker: (marker) => {
      console.log('marker', marker)
    },
    dev: { '/dpkg/crm': apps.crm.covenant },
    path: '/list',
    init: [add],
  },
}
const enable = () => Debug.enable('*Map iplog')
const Template = (args) => {
  enable()
  return (
    <Engine {...args}>
      <Syncer path={args.path}>
        <Map {...args} />
      </Syncer>
    </Engine>
  )
}

export const Basic = Template.bind({})

export const CardColumn = (args) => {
  enable()
  return (
    <>
      <Glass.Container>
        <Glass.Left min>
          <Card style={{ minHeight: '200px' }}>
            <CardContent>Right hand side is draggable</CardContent>
          </Card>
        </Glass.Left>
      </Glass.Container>
      <Map />
    </>
  )
}
export const NoPolygons = Template.bind({})
NoPolygons.args = {
  onCreate: undefined,
}

export const Polygons = Template.bind({})
Polygons.args = {
  init: [add, makeRouting()],
}

export const WithCustomers = Template.bind({})
WithCustomers.args = {
  markers: true,
  sector: '26',
}
export const ClickSectors = (args) => {
  enable()
  const [sector, onSector] = React.useState()
  // use wd to know which sector is selected
  return (
    <div>
      <Glass.Container>
        <Glass.Left>
          <Card>
            <CardContent>Selected:{sector}</CardContent>
          </Card>
        </Glass.Left>
      </Glass.Container>
      <Map onSector={onSector} sector={sector} />
    </div>
  )
  // TODO script some actual clicking
}
export const ClickCustomers = (args) => {
  enable()
  const initialSector = '34'
  const [marker, onMarker] = React.useState()
  const [sector, onSector] = React.useState(initialSector)

  return (
    <div>
      <Glass.Container>
        <Glass.Left>
          <Card>
            <CardContent>Selected Marker:{marker}</CardContent>
          </Card>
        </Glass.Left>
      </Glass.Container>
      <Map
        onMarker={onMarker}
        markers
        onSector={onSector}
        marker={marker}
        sector={sector}
      />
    </div>
  )
  // TODO script some actual clicking
}

const Customers = (args) => {
  enable()
  const [sector, onSector] = React.useState('26')
  const [marker, onMarker] = React.useState()
  args = { ...args, onSector, sector, onMarker, marker }
  return <Map {...args} />
}
export const SmallCustomers = Customers.bind({})
SmallCustomers.args = {
  // mount customers as a car import ?
  markers: true,
}
export const MediumCustomers = Customers.bind({})
MediumCustomers.args = {
  markers: true,
}
export const LargeCustomers = Customers.bind({})
LargeCustomers.args = {
  markers: true,
}
