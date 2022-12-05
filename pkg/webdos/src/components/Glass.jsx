import React from 'react'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import PropTypes from 'prop-types'

const Container = ({ children, debug }) => {
  const background = debug ? 'purple' : undefined
  return (
    <Grid
      container
      padding={2}
      spacing={2}
      sx={{
        zIndex: 1,
        position: 'relative',
        pointerEvents: 'none',
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        background,
      }}
    >
      {children}
    </Grid>
  )
}
Container.propTypes = { children: PropTypes.node, debug: PropTypes.bool }

const Left = ({ children, debug }) => {
  const grid = debug ? 'red' : undefined
  const stack = debug ? 'blue' : undefined
  return (
    <Grid item sx={{ background: grid, maxHeight: '100%' }}>
      <Stack
        spacing={2}
        sx={{
          pointerEvents: 'auto',
          display: 'flex',
          minWidth: 375,
          maxWidth: 375,
          background: stack,
          maxHeight: '100%',
        }}
      >
        {children}
      </Stack>
    </Grid>
  )
}
Left.propTypes = { children: PropTypes.node, debug: PropTypes.bool }

const Center = ({ children, debug }) => {
  const grid = debug ? 'orange' : undefined
  const stack = debug ? 'green' : undefined
  return (
    <Grid item sx={{ flexGrow: 1, background: grid }}>
      <Stack
        spacing={2}
        sx={{
          pointerEvents: 'auto',
          display: 'flex',
          background: stack,
        }}
      >
        {children}
      </Stack>
    </Grid>
  )
}
Center.propTypes = { children: PropTypes.node, debug: PropTypes.bool }

const Rest = ({ children }) => (
  <Box
    sx={{ flexGrow: 1, flexShrink: 0, display: 'flex', background: 'green' }}
  >
    {children}
  </Box>
)
Rest.propTypes = { children: PropTypes.node }
export default { Container, Left, Center, Rest }
