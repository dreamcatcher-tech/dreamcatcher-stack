import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { AppBar, Toolbar } from '@material-ui/core'
import { List, ListItem, ListItemText } from '@material-ui/core'
import { IconButton } from '@material-ui/core'
import { Home, AccountCircle, Settings, Info } from '@material-ui/icons'
import { makeStyles } from '@material-ui/core'
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

const Nav = (props) => {
  debug(`props: `, props)
  const classes = useStyles()
  const { matchedPath } = useRouter()
  debug('matched path:', matchedPath)
  const children = useChildren(matchedPath, masked)
  debug(`aliases: `, children)
  const { engine, wd } = useBlockchain()

  const navLinks = Object.keys(children).map((child) => ({
    title: child, // TODO get the blocks of the children, and get titles out of datums
  }))
  const onClick = (child) => () => {
    // TODO replace with <NavLink> components that handle this automatically
    debug(`onclick`, child)
    const nextPath = matchedPath + '/' + child
    if (wd.includes(nextPath)) {
      debug(`no change to ${matchedPath}`)
      return
    }
    engine.cd(nextPath)
  }

  const makeButtonIcon = (name, icon, description) => (
    <IconButton
      edge="end"
      aria-label={description}
      aria-haspopup="true"
      onClick={onClick(name)}
      color="inherit"
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
            {navLinks.map(({ title }) => (
              <div
                key={title}
                className={classes.linkText}
                onClick={onClick(title)}
              >
                <ListItem button>
                  <ListItemText primary={title} />
                </ListItem>
              </div>
            ))}
          </List>
          <div className={classes.grow} />
          {makeButtonIcon('about', <Info />, 'about')}
          {makeButtonIcon('settings', <Settings />, 'application settings')}
          {makeButtonIcon('account', <AccountCircle />, 'current user account')}
        </Toolbar>
      </AppBar>
      {props.children}
    </>
  )
}
Nav.propTypes = { children: PropTypes.node }

export default Nav
