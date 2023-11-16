import Input from './Input'
import Stack from '@mui/material/Stack'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import Avatar from '@mui/material/Avatar'
import DaveIcon from '@mui/icons-material/SentimentDissatisfied'
import Paper from '@mui/material/Paper'

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
  if (crisp.absolutePath !== '/.HAL') {
    throw new Error(`${crisp.absolutePath} !== '/.HAL'`)
  }
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        width: '100%',
        // background: 'purple',
      }}
    >
      <Box
        sx={{
          height: '100%',
          maxWidth: '400px',
          width: '400px',
          minWidth: '400px',
          // backgroundColor: 'lightGray',
          display: 'flex',
        }}
      >
        <Stack
          direction="column"
          alignItems="flex-start"
          justifyContent="flex-end"
          p={1}
        >
          <List sx={{ width: '100%' }}>
            <HAL message={'this is a message'} />
            <Dave message={'i am dave and i suck at computing'} />
            <HAL
              message={
                'this is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is a really long piece of text that goes on for a while and is really long and is '
              }
            />
          </List>
          <Input crisp={crisp} />
        </Stack>
      </Box>
      <Box sx={{ flexGrow: 1, p: 1 }}>
        <Paper elevation={6} sx={{ height: '100%', flexGrow: 1 }}></Paper>
      </Box>
    </Box>
  )
}
ThreeBox.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default ThreeBox
