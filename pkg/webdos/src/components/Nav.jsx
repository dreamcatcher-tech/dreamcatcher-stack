import React from 'react'
import { api } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import Debug from 'debug'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Home from '@mui/icons-material/Home'
import AccountCircle from '@mui/icons-material/AccountCircle'
import Settings from '@mui/icons-material/Settings'
import Info from '@mui/icons-material/Info'
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
