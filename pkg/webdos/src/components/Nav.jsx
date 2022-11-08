import React from 'react'
import { api } from '@dreamcatcher-tech/interblock'
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
const Nav = ({ complex }) => {
  const { network, wd, actions } = complex
  debug(`network: `, network)
  const navLinks = network
    .filter(({ path }) => !masked.includes(path))
    .map(({ path }) => {
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
      onClick={() => actions.cd('/' + path)}
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
          {complex.hasChild('about') &&
            makeButtonIcon('about', <Info />, 'About the CRM')}
          {complex.hasChild('settings') &&
            makeButtonIcon('settings', <Settings />, 'Application Settings')}
          {complex.hasChild('account') &&
            makeButtonIcon('account', <AccountCircle />, 'User Account')}
        </Toolbar>
      </AppBar>
    </>
  )
}
Nav.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
}

export default Nav
