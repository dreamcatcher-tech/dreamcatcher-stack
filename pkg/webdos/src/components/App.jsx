import Box from '@mui/system/Box'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React from 'react'
import { Glass, Nav, Schedules, CollectionList, Routing } from '.'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('webdos:components:App')

export default function App({ crisp }) {
  const { wd } = crisp
  debug('wd', wd)
  // TODO replace lazy with https://www.npmjs.com/package/react-lazyload
  let customers, routing, schedules
  if (!crisp.isLoadingChildren && crisp.hasChild('customers')) {
    customers = crisp.getChild('customers')
  }
  if (!crisp.isLoadingChildren && crisp.hasChild('routing')) {
    routing = crisp.getChild('routing')
  }
  if (!crisp.isLoadingChildren && crisp.hasChild('schedules')) {
    schedules = crisp.getChild('schedules')
  }
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <>
        <Box sx={{ zIndex: 1 }}>
          <Nav crisp={crisp} />
        </Box>
        {isLoading(crisp) ? (
          <div>Loading...</div>
        ) : (
          <>
            <Glass.Lazy show={wd.startsWith('/schedules')}>
              <Schedules crisp={schedules} />
            </Glass.Lazy>
            <Glass.Lazy show={wd.startsWith('/customers')}>
              <CollectionList crisp={customers} />
            </Glass.Lazy>
            <Glass.Lazy show={wd.startsWith('/routing')}>
              <Routing crisp={routing} customers={customers} />
            </Glass.Lazy>
          </>
        )}
      </>
    </Box>
  )
}
App.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
}

const isLoading = (crisp) => {
  if (crisp.isLoadingChildren) {
    return true
  }
  return (
    !crisp.hasChild('schedules') ||
    !crisp.hasChild('customers') ||
    !crisp.hasChild('routing')
  )
}
