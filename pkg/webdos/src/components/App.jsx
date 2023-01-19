import Box from '@mui/system/Box'
import { api, Crisp } from '@dreamcatcher-tech/interblock'
import React from 'react'
import { Glass, Nav, Schedule, CollectionList, Routing } from '.'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('webdos:components:App')

export default function App({ crisp }) {
  const { wd } = crisp
  debug('wd', wd)
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
      {crisp.isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          <Box sx={{ zIndex: 1 }}>
            <Nav crisp={crisp} />
          </Box>
          <Glass.Lazy show={wd.startsWith('/schedule')}>
            <Schedule complex={crisp.getChild('schedule')} />
          </Glass.Lazy>
          <Glass.Lazy show={wd.startsWith('/customers')}>
            <CollectionList complex={crisp.getChild('customers')} />
          </Glass.Lazy>
          <Glass.Lazy show={wd.startsWith('/routing')}>
            <Routing complex={crisp.getChild('routing')} />
          </Glass.Lazy>
        </>
      )}
    </Box>
  )
}
App.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
}
