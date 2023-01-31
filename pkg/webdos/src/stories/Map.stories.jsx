import React from 'react'
import { Engine, Syncer, Map, Glass } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
const {
  crm: { faker },
} = apps
const debug = Debug('Map')

const sectorsAdd = { add: { path: 'routing', installer: '/dpkg/crm/routing' } }
const sectorsBatch = faker.routing.generateBatch(5)
const sectorsInsert = { 'routing/batch': { batch: sectorsBatch } }
const listAdd = { add: { path: 'customers', installer: '/dpkg/crm/customers' } }
const listBatch = faker.customers.generateBatchInside(sectorsBatch, 5)
const listInsert = { 'customers/batch': { batch: listBatch } }

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
    path: '/routing',
    init: [sectorsAdd],
  },
}
const enable = () => Debug.enable('*Map iplog *Syncer* crm:routing')
const Template = (args) => {
  enable()
  return (
    <Engine {...args}>
      <Syncer path="/">
        <Syncer.UnWrapper path="/routing">
          <Map {...args} />
        </Syncer.UnWrapper>
      </Syncer>
    </Engine>
  )
}

export const Basic = Template.bind({})

export const NoPolygons = Template.bind({})
NoPolygons.args = {
  onCreate: undefined,
}

export const Polygons = Template.bind({})
Polygons.args = {
  init: [sectorsAdd, sectorsInsert],
}

export const WithCustomers = Template.bind({})
WithCustomers.args = {
  markers: true,
  sector: '2',
  init: [
    sectorsAdd,
    sectorsInsert,
    listAdd,
    listInsert,
    { 'routing/update': { path: '/customers' } },
  ],
}
export const ClickSectors = (args) => {
  enable()
  const [sector, onSector] = React.useState('0')
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
      <Engine {...args}>
        <Syncer path={args.path}>
          <Map {...args} onSector={onSector} sector={sector} />
        </Syncer>
      </Engine>
    </div>
  )
  // TODO script some actual clicking
}
ClickSectors.args = {
  init: [sectorsAdd, sectorsInsert],
}

export const ClickCustomers = (args) => {
  enable()
  const [marker, onMarker] = React.useState()
  const [sector, onSector] = React.useState('4')

  return (
    <div>
      <Glass.Container>
        <Glass.Left>
          <Card>
            <CardContent>Selected Marker:{marker}</CardContent>
          </Card>
        </Glass.Left>
      </Glass.Container>
      <Engine {...args}>
        <Syncer path="/">
          <Syncer.UnWrapper path="/routing">
            <Map
              {...args}
              onMarker={onMarker}
              markers
              onSector={onSector}
              marker={marker}
              sector={sector}
            />
          </Syncer.UnWrapper>
        </Syncer>
      </Engine>
    </div>
  )
  // TODO script some actual clicking
}
ClickCustomers.args = {
  init: [
    sectorsAdd,
    sectorsInsert,
    listAdd,
    listInsert,
    { 'routing/update': { path: '/customers' } },
  ],
}

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
