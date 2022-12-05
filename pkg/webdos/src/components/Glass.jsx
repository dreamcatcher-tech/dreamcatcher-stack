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
      sx={{
        zIndex: 1,
        // position: 'relative',
        pointerEvents: 'none',
        height: '100%',
        background,
      }}
      spacing={2}
    >
      {children}
    </Grid>
  )
}
Container.propTypes = { children: PropTypes.node, debug: PropTypes.bool }

const Left = ({ children, debug }) => {
  const grid = debug ? 'orange' : undefined
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
  const grid = debug ? 'yellow' : undefined
  const stack = debug ? 'blue' : undefined
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

export default { Container, Left, Center }
