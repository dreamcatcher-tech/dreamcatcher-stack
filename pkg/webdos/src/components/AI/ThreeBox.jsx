import Input from './Input'
import Stack from '@mui/material/Stack'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React, { useState, useCallback } from 'react'
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
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const debug = Debug('AI:ThreeBox')
debug(`loaded`)

const HAL = ({ message }) => (
  <ListItem alignItems="flex-start">
    <ListItemAvatar>
      <Avatar src="https://dreamcatcher.land/img/dreamcatcher.svg"></Avatar>
    </ListItemAvatar>
    <ListItemText
      primary="HAL"
      secondaryTypographyProps={{ component: 'div', color: 'text.primary' }}
      secondary={<Markdown remarkPlugins={[remarkGfm]}>{message}</Markdown>}
    />
  </ListItem>
)
HAL.propTypes = { message: PropTypes.string }
const Dave = ({ message }) => (
  <>
    <ListItem alignItems="flex-start">
      <ListItemAvatar>
        <Avatar>
          <DaveIcon />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary="Dave"
        secondaryTypographyProps={{
          component: 'div',
          color: 'text.primary',
        }}
        secondary={<Markdown remarkPlugins={[remarkGfm]}>{message}</Markdown>}
      />
    </ListItem>
  </>
)
Dave.propTypes = { message: PropTypes.string }

let key = 0

const ThreeBox = ({ crisp }) => {
  if (!crisp || crisp.isLoading) {
    return
  }
  if (crisp.absolutePath !== '/.HAL') {
    throw new Error(`${crisp.absolutePath} !== '/.HAL'`)
  }
  const [messages, setMessages] = useState([])
  const onSend = useCallback(
    (value) => {
      key++
      setMessages((messages) => [...messages, { type: 'Dave', value }])

      return crisp.ownActions
        .user(value, key + '')
        .then(({ text }) => {
          // push a new item on the stack
          console.log(text)
          setMessages((messages) => [
            ...messages,
            { type: 'HAL', value: text, key },
          ])
        })
        .catch(console.error)
    },
    [crisp]
  )
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
          sx={{ width: '100%' }}
        >
          <List>
            {messages.map(({ type, value, key }, index) => {
              if (type === 'HAL') {
                return <HAL key={index} message={value} />
              }
              return <Dave key={index} message={value} />
            })}
          </List>
          <Input onSend={onSend} />
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
