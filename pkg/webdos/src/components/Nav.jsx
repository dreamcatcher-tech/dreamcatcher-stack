import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { AppBar, Toolbar } from '@mui/material'
import { List, ListItemButton, ListItemText } from '@mui/material'
import { IconButton } from '@mui/material'
import { Home, AccountCircle, Settings, Info } from '@mui/icons-material'
const debug = Debug('terminal:widgets:Nav')

const masked = ['.@@io', 'about', 'settings', 'account']

const Nav = ({ children, onCd, selected }) => {
  debug(`children: `, children)
  const navLinks = children
    .filter((path) => !masked.includes(path))
    .map((path) => {
      const title = path
      return (
        <ListItemButton
          key={title}
          sx={{ textTransform: 'uppercase', color: 'white' }}
          onClick={() => onCd(path)}
          selected={selected === path}
        >
          <ListItemText primary={title} />
        </ListItemButton>
      )
    })
  // TODO dig into datums and get full title

  const makeButtonIcon = (path, icon, description) => (
    <IconButton
      edge="end"
      aria-label={description}
      aria-haspopup="true"
      onClick={() => onCd(path)}
      color="inherit"
      selected={selected === path}
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
          {children.includes('about') &&
            makeButtonIcon('about', <Info />, 'about')}
          {children.includes('settings') &&
            makeButtonIcon('settings', <Settings />, 'application settings')}
          {children.includes('account') &&
            makeButtonIcon('account', <AccountCircle />, 'user account')}
        </Toolbar>
      </AppBar>
    </>
  )
}
Nav.propTypes = {
  /**
   * List of paths that the links point to
   */
  children: PropTypes.arrayOf(PropTypes.string).isRequired,
  /**
   * Handle clicking on a link
   */
  onCd: PropTypes.func.isRequired,
  /**
   * Which item in children is currently selected ?
   */
  selected: PropTypes.string,
}

export default Nav
