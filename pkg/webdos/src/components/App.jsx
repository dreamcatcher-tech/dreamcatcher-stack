import { Box } from '@mui/system'
import React from 'react'
import { Nav, Schedule, CollectionList, Routing } from '.'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('webdos:components:App')

export default function App(props) {
  const { wd } = props
  debug('wd', wd)
  debug('props', props)
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
      <Nav {...props} />
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
        {wd.startsWith('/schedule') && <Schedule {...props} />}
        {wd.startsWith('/customers') && <CollectionList {...props} />}
        {wd.startsWith('/routing') && <Routing {...props} />}
      </Box>
    </Box>
  )
}
App.propTypes = {
  wd: PropTypes.string,
}
