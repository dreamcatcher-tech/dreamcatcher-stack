import Box from '@mui/system/Box'
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
      }}
    >
      <Box sx={{ zIndex: 1 }}>
        <Nav complex={complex} />
      </Box>
      <Lazy show={wd.startsWith('/schedule')}>
        <Schedule complex={complex.child('schedule')} />
      </Lazy>
      <Lazy show={wd.startsWith('/customers')}>
        <CollectionList complex={complex.child('customers')} />
      </Lazy>
      <Lazy show={wd.startsWith('/routing')}>
        <Routing complex={complex.child('routing')} />
      </Lazy>
    </Box>
  )
}
App.propTypes = {
  complex: PropTypes.instanceOf(api.Complex),
}

const Lazy = ({ show, children }) => {
  const [mounted, setMounted] = React.useState(show)
  if (show && !mounted) {
    setMounted(true)
  }
  if (mounted) {
    return (
      <Box sx={{ spacing: 1, flexGrow: 1, display: show ? null : 'none' }}>
        {children}
      </Box>
    )
  }
}
Lazy.propTypes = {
  show: PropTypes.bool,
  children: PropTypes.node,
}
