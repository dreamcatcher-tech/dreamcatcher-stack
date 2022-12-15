import React from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
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
        maxWidth: '100%',
        background,
        p: 1,
        overflow: 'hidden',
        maxHeight: '100%',
      }}
      spacing={1}
      wrap="nowrap"
    >
      {children}
    </Grid>
  )
}
Container.propTypes = { children: PropTypes.node, debug: PropTypes.bool }

const Left = ({ children, debug, min }) => {
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
          height: min ? undefined : '100%',
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
   * If true, the left panel will be as small as possible.
   */
  min: PropTypes.bool,
}

import useResizeObserver from 'use-resize-observer'

const Center = ({ children, debug }) => {
  const grid = debug ? 'yellow' : undefined
  const stack = debug ? 'blue' : undefined
  const { ref, width = 1, height = 1 } = useResizeObserver()
  if (children) {
    React.Children.only(children)
    children = React.cloneElement(children, { width, height })
  }
  return (
    <Grid item sx={{ flexGrow: 1, background: grid }} ref={ref}>
      <Stack
        spacing={1}
        sx={{
          pointerEvents: 'auto',
          display: 'flex',
          background: stack,
          maxHeight: '100%',
        }}
      >
        {children}
      </Stack>
    </Grid>
  )
}
Center.propTypes = {
  children: PropTypes.node,
  debug: PropTypes.bool,
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
export default { Container, Left, Center, Lazy }
