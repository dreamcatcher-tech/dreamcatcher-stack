import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { AppBar, Toolbar } from '@mui/material'
import { List, ListItemButton, ListItemText, Typography } from '@mui/material'
import { IconButton } from '@mui/material'
import { Home, AccountCircle, Settings, Info } from '@mui/icons-material'
const debug = Debug('terminal:widgets:Nav')

const masked = ['.@@io', 'about', 'settings', 'account']
/**
 * Navigation bar that renders links based on the children
 * of the root of the app complex.
 */
const Nav = ({ state, network, actions, wd }) => {
  debug(`network: `, network)
  const navLinks = Object.keys(network)
    .filter((path) => !masked.includes(path))
    .map((path) => {
      const title = path
      const selected = wd.startsWith('/' + path)
      return (
        <ListItemButton
          key={title}
          sx={{ textTransform: 'uppercase', color: 'white' }}
          onClick={() => actions.cd('/' + path)}
          selected={selected}
        >
          <ListItemText
            primary={
              <Typography fontWeight={selected && 'bold'}>{title}</Typography>
            }
          />
        </ListItemButton>
      )
    })
  // TODO dig into datums and get full title

  const makeButtonIcon = (path, icon, description) => (
    <IconButton
      edge="end"
      aria-label={description}
      aria-haspopup="true"
      onClick={() => actions.cd(path)}
      color="inherit"
      selected={wd.startsWith('/' + path)}
    >
      {icon}
    </IconButton>
  )
  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" aria-label="home">
            <Home />
          </IconButton>
          <List
            component="nav"
            aria-labelledby="main navigation"
            sx={{ display: `flex`, justifyContent: `space-between` }}
          >
            {navLinks}
          </List>
          <div style={{ flexGrow: 1 }} />
          {network['about'] &&
            makeButtonIcon('about', <Info />, 'About the CRM')}
          {network['settings'] &&
            makeButtonIcon('settings', <Settings />, 'Application Settings')}
          {network['account'] &&
            makeButtonIcon('account', <AccountCircle />, 'User Account')}
        </Toolbar>
      </AppBar>
    </>
  )
}
Nav.propTypes = {
  state: PropTypes.object,
  /**
   * List of paths that the links point to
   */
  network: PropTypes.object.isRequired,
  /**
   * Handle clicking on a link
   */
  actions: PropTypes.objectOf(PropTypes.func.isRequired),
  /**
   * The current working directory, relative to the
   * app root, not the engine root.
   */
  wd: PropTypes.string,
}

export default Nav
