import Box from '@mui/system/Box'
import { api } from '@dreamcatcher-tech/interblock'
import React from 'react'
import { Glass, Nav, Schedule, CollectionList, Routing } from '.'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('webdos:components:App')

export default function App({ complex }) {
  const { wd } = complex
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
      {complex.isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          <Box sx={{ zIndex: 1 }}>
            <Nav complex={complex} />
          </Box>
          <Glass.Lazy show={wd.startsWith('/schedule')}>
            <Schedule complex={complex.child('schedule')} />
          </Glass.Lazy>
          <Glass.Lazy show={wd.startsWith('/customers')}>
            <CollectionList complex={complex.child('customers')} />
          </Glass.Lazy>
          <Glass.Lazy show={wd.startsWith('/routing')}>
            <Routing complex={complex.child('routing')} />
          </Glass.Lazy>
        </>
      )}
    </Box>
  )
}
App.propTypes = {
  complex: PropTypes.instanceOf(api.Complex),
}
