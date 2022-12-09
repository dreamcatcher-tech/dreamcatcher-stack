import React from 'react'
import { Map, Glass } from '..'
import Debug from 'debug'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import data from './data'
const debug = Debug('Map')

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
  },
}
const enable = () => Debug.enable('*Map')
const Template = (args) => {
  enable()
  return <Map {...args} />
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

const complex = data.medium.child('routing')
export const Polygons = Template.bind({})
// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
Polygons.args = {
  complex,
}

export const WithCustomers = Template.bind({})
WithCustomers.args = {
  complex,
  markers: true,
  selected: '26',
}
export const ClickSectors = (args) => {
  enable()
  const [sector, onSector] = React.useState()
  return (
    <div>
      <Glass.Container>
        <Glass.Left>
          <Card>
            <CardContent>Selected:{sector}</CardContent>
          </Card>
        </Glass.Left>
      </Glass.Container>
      <Map onSector={onSector} complex={complex} sector={sector} />
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
        complex={complex}
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
  complex: data.small.child('routing'),
  markers: true,
}
export const MediumCustomers = Customers.bind({})
MediumCustomers.args = {
  complex: data.medium.child('routing'),
  markers: true,
}
export const LargeCustomers = Customers.bind({})
LargeCustomers.args = {
  complex: data.large.child('routing'),
  markers: true,
}
