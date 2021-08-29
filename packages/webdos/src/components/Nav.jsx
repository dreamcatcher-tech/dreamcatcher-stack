import React from 'react'
import Debug from 'debug'
import { AppBar, Toolbar } from '@material-ui/core'
import { List, ListItem, ListItemText } from '@material-ui/core'
import { IconButton } from '@material-ui/core'
import { Home, AccountCircle, Settings, Info } from '@material-ui/icons'
import { makeStyles } from '@material-ui/core'
import { useRouter } from '../hooks'
import process from 'process'
const debug = Debug('terminal:widgets:Nav')

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
  const { blocks, match, cwd } = useRouter()
  const [block] = blocks
  const children = getChildren(block)
  debug(`aliases: `, children)

  const navLinks = children.map((child) => ({
    title: child, // TODO get the blocks of the children, and get titles out of datums
  }))
  const onClick = (child) => () => {
    // TODO replace with <NavLink> components that handle this automatically
    debug(`onclick`, child)
    const nextPath = match + '/' + child
    if (cwd === nextPath) {
      debug(`no change to ${match}`)
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
const getChildren = (block) => {
  const masked = ['..', '.', '.@@io', 'about', 'settings', 'account']
  return block.network.getAliases().filter((alias) => !masked.includes(alias))
}
export default Nav
