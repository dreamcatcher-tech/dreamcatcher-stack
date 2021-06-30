import React from 'react'
import Debug from 'debug'
import Explorer from './Explorer'
import { getNextPath } from '../utils'
import { AppBar, Toolbar } from '@material-ui/core'
import { List, ListItem, ListItemText } from '@material-ui/core'
import { IconButton } from '@material-ui/core'
import { Home, AccountCircle, Settings, Info } from '@material-ui/icons'
import { makeStyles } from '@material-ui/core'
const debug = Debug('terminal:widgets:Home')
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
  const { block, path, cwd } = props
  const nextPath = getNextPath(path, cwd)
  const nextProps = { ...props, cwd: nextPath }
  // TODO let Explorer figure out the nextProps on its own
  const child = nextPath ? <Explorer {...nextProps} /> : null

  const children = getChildren(block)
  debug(`aliases: `, children)
  const navLinks = children.map((child) => ({
    title: child,
    path: '/' + child,
  }))
  const onClick = (child) => () => {
    debug(`onclick`, child)
    const nextPath = cwd + '/' + child
    if (path === nextPath) {
      debug(`no change to ${path}`)
      return
    }
    const command = `cd ${nextPath}\n`
    for (const c of command) {
      process.stdin.send(c)
    }
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
            {navLinks.map(({ title, path }) => (
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
      {child}
    </>
  )
}
const getChildren = (block) => {
  const masked = ['..', '.', '.@@io', 'about', 'settings', 'account']
  return block.network.getAliases().filter((alias) => !masked.includes(alias))
}
export default Nav
