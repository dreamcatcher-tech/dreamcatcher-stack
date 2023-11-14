import Input from './Input'
import Grid from '@mui/material/Unstable_Grid2'
import Stack from '@mui/material/Stack'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'

import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import Avatar from '@mui/material/Avatar'
import ImageIcon from '@mui/icons-material/Image'
import WorkIcon from '@mui/icons-material/Work'
import BeachAccessIcon from '@mui/icons-material/BeachAccess'
import DaveIcon from '@mui/icons-material/SentimentDissatisfied'
import Paper from '@mui/material/Paper'
import process from 'process'

const debug = Debug('AI:ThreeBox')
debug(`loaded`)

const HAL = ({ message }) => (
  <ListItem alignItems="flex-start">
    <ListItemAvatar>
      <Avatar src="https://dreamcatcher.land/img/dreamcatcher.svg"></Avatar>
    </ListItemAvatar>
    <ListItemText primary="HAL" secondary={message} />
  </ListItem>
)
HAL.propTypes = { message: PropTypes.string }
const Dave = ({ message }) => (
  <ListItem alignItems="flex-start">
    <ListItemAvatar>
      <Avatar>
        <DaveIcon />
      </Avatar>
    </ListItemAvatar>
    <ListItemText primary="Dave" secondary={message} />
  </ListItem>
)
Dave.propTypes = { message: PropTypes.string }

const ThreeBox = ({ crisp }) => {
  if (!crisp || crisp.isLoading) {
    return
  }
  return (
    <Grid
      container
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
      }}
    >
      <Grid container xs="auto" sx={{ height: '100%' }}>
        <Stack
          direction="column"
          alignItems="flex-start"
          justifyContent="flex-end"
          flexGrow={1}
          sx={{ maxWidth: '400px', width: '400px' }}
          spacing={1}
          p={1}
        >
          <List sx={{ width: '100%' }}>
            <HAL message={'this is a message'} />
            <Dave message={'i am dave'} />
            <HAL
              message={
                'this is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is '
              }
            />
          </List>
          <Input />
        </Stack>
      </Grid>
      <Grid sx={{ flexGrow: '1' }} container>
        <Paper elevation={2} sx={{ flexGrow: 1 }}></Paper>
      </Grid>
    </Grid>
  )
}
ThreeBox.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default ThreeBox
