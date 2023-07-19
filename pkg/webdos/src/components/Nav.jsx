import CircularProgress from '@mui/material/CircularProgress'
import { green } from '@mui/material/colors'
import React, { useState } from 'react'
import { Crisp } from '@dreamcatcher-tech/interblock'
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
import Sync from '@mui/icons-material/Sync'
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges'
import assert from 'assert-fast'
const debug = Debug('terminal:widgets:Nav')

const masked = ['.', '..', '.@@io', 'about', 'settings', 'account']
/**
 * Navigation bar that renders links based on the children
 * of the root of the app complex.
 */
const Nav = ({ crisp }) => {
  if (crisp.isLoadingChildren) {
    return <div>Loading Navigation...</div>
  }
  const { wd, actions } = crisp
  const children = [...crisp]
  debug(`network: `, [...crisp])
  debug('wd: ', wd)
  debug('crisp: ', crisp)
  const [tails, setTails] = useState({})
  const cdOnce = (path) => {
    assert(children.includes(path), `path ${path} not found in ${children}`)
    if (!wd.startsWith('/' + path)) {
      for (const child of children) {
        if (wd.startsWith('/' + child)) {
          debug('setting tails for %s to %s', child, wd)
          // TODO determine if is virtual
          setTails({ ...tails, [child]: wd })
        }
      }
      const last = tails[path] || '/' + path
      debug('cdOnce %s', last, tails)
      const allowVirtual = true
      return actions.cd(crisp.absolutePath + last, allowVirtual)
      // TODO make components handle invalid paths being restored
    }
  }

  const navLinks = [...crisp]
    .filter((path) => !masked.includes(path))
    .map((path) => {
      const title = path
      const selected = wd.startsWith('/' + path)
      return (
        <ListItemButton
          key={title}
          sx={{ textTransform: 'uppercase', color: 'white' }}
          onClick={() => cdOnce(path)}
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
      onClick={() => cdOnce(path)}
      color="inherit"
      selected={wd.startsWith('/' + path)}
    >
      {icon}
    </IconButton>
  )
  // TODO change List to tabs
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
          <SyncStatus isLoaded={crisp.isDeepLoaded} />
          {crisp.hasChild('about') &&
            makeButtonIcon('about', <Info />, 'About the CRM')}
          {crisp.hasChild('settings') &&
            makeButtonIcon('settings', <Settings />, 'Application Settings')}
          {crisp.hasChild('account') &&
            makeButtonIcon('account', <AccountCircle />, 'User Account')}
        </Toolbar>
      </AppBar>
    </>
  )
}
Nav.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
}

const SyncStatus = ({ isLoaded }) => {
  const buttonSx = {
    ...(isLoaded && {
      bgcolor: green[500],
    }),
    pointerEvents: 'none',
  }
  const Icon = isLoaded ? PublishedWithChangesIcon : Sync
  const text = isLoaded ? 'Syncing...' : 'Synced'
  // TODO make progress definite based on queue length and peak queue length
  // show percentage in the button
  // tooltip showing the time it has been loading for, and once finished
  // the time it took to load
  return (
    <>
      <IconButton
        edge="end"
        aria-label={text}
        aria-haspopup="true"
        color="inherit"
        sx={buttonSx}
      >
        <Icon />
        {!isLoaded && (
          <CircularProgress
            sx={{
              color: green[500],
              position: 'absolute',
            }}
          />
        )}
      </IconButton>
    </>
  )
}
SyncStatus.propTypes = { isLoaded: PropTypes.bool }
export default Nav
