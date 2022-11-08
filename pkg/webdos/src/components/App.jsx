import { Box } from '@mui/system'
import { api } from '@dreamcatcher-tech/interblock'
import React from 'react'
import { Nav, Schedule, CollectionList, Routing } from '.'
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
      <Nav complex={complex} />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'red',
          position: 'relative',
        }}
      >
        {wd.startsWith('/schedule') && (
          <Schedule complex={complex.child('schedule')} />
        )}
        {wd.startsWith('/customers') && (
          <CollectionList complex={complex.child('customers')} />
        )}
        {wd.startsWith('/routing') && (
          <Routing complex={complex.child('routing')} />
        )}
      </Box>
    </Box>
  )
}
App.propTypes = {
  complex: PropTypes.instanceOf(api.Complex),
}
