import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { AppBar, Toolbar } from '@mui/material'
import { List, ListItemButton, ListItemText } from '@mui/material'
import { IconButton } from '@mui/material'
import { Home, AccountCircle, Settings, Info } from '@mui/icons-material'
import { makeStyles } from '@mui/styles'
import { useRouter, useChildren, useBlockchain } from '../hooks'
const debug = Debug('terminal:widgets:Nav')

const masked = ['.@@io', 'about', 'settings', 'account']
const useStyles = makeStyles({
  grow: {
    flexGrow: 1,
  },
  navDisplayFlex: {
    display: `flex`,
    justifyContent: `space-between`,
  },
  linkText: {
    textDecoration: `none`,
    textTransform: `uppercase`,
    color: `white`,
  },
})

const Nav = ({ children, onCd, selected }) => {
  debug(`children: `, children)
  const classes = useStyles()
  const navLinks = children
    .filter((path) => !masked.includes(path))
    .map((path) => {
      const title = path
      return (
        <div
          key={title}
          className={classes.linkText}
          onClick={() => onCd(path)}
        >
          <ListItemButton selected={selected === path}>
            <ListItemText primary={title} />
          </ListItemButton>
        </div>
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
            className={classes.navDisplayFlex}
          >
            {navLinks}
          </List>
          <div className={classes.grow} />
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
