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
        position: 'relative',
        pointerEvents: 'none',
        height: '100%',
        background,
      }}
      spacing={1}
    >
      {children}
    </Grid>
  )
}
Container.propTypes = { children: PropTypes.node, debug: PropTypes.bool }

const Left = ({ children, debug, max }) => {
  const grid = debug ? 'orange' : undefined
  const stack = debug ? 'blue' : undefined
  return (
    <Grid
      item
      sx={{
        background: grid,
        maxHeight: '100%',
        minWidth: 375,
        maxWidth: 375,
      }}
    >
      <Stack
        spacing={1}
        sx={{
          pointerEvents: 'auto',
          display: 'flex',
          background: stack,
          maxHeight: '100%',
          height: max ? '100%' : undefined,
        }}
      >
        {children}
      </Stack>
    </Grid>
  )
}
Left.propTypes = {
  children: PropTypes.node,
  debug: PropTypes.bool,
  /**
   * Set the stack to grow to full heigth.
   * Used to create a component that can grab the remaining space.
   */
  max: PropTypes.bool,
}

const Center = ({ children, debug }) => {
  const grid = debug ? 'yellow' : undefined
  const stack = debug ? 'blue' : undefined
  return (
    <Grid item sx={{ flexGrow: 1, background: grid }}>
      <Stack
        spacing={1}
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
    sx={{
      flexGrow: 1,
      display: 'flex',
      background: 'green',
      flexDirection: 'column',
      overflow: 'hidden',
    }}
  >
    {children}
  </Box>
)
Rest.propTypes = { children: PropTypes.node }
export default { Container, Left, Center, Rest }
