import React from 'react'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import PropTypes from 'prop-types'

const Container = ({ children }) => (
  <Grid
    container
    padding={2}
    spacing={2}
    sx={{
      zIndex: 1,
      position: 'relative',
      pointerEvents: 'none',
      display: 'flex',
    }}
  >
    {children}
  </Grid>
)
Container.propTypes = { children: PropTypes.node }

const Left = ({ children }) => (
  <Grid item sx={{ minWidth: 375, maxWidth: 375, display: 'flex' }}>
    <Stack spacing={2} sx={{ pointerEvents: 'auto', display: 'flex' }}>
      {children}
    </Stack>
  </Grid>
)
Left.propTypes = { children: PropTypes.node }

const Rest = ({ children }) => (
  <Grid item sx={{ flexGrow: 1, display: 'flex' }}>
    <Stack spacing={2} sx={{ pointerEvents: 'auto', display: 'flex' }}>
      {children}
    </Stack>
  </Grid>
)
Rest.propTypes = { children: PropTypes.node }
export default { Container, Left, Rest }
