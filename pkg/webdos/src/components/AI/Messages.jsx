import { ObjectInspector, chromeDark } from 'react-inspector'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import DaveIcon from '@mui/icons-material/SentimentDissatisfied'
import ToolIcon from '@mui/icons-material/Construction'
import HalIcon from '@mui/icons-material/Psychology'
import Markdown from 'markdown-to-jsx'
import Timeline from '@mui/lab/Timeline'
import TimelineItem, { timelineItemClasses } from '@mui/lab/TimelineItem'
import TimelineSeparator from '@mui/lab/TimelineSeparator'
import TimelineConnector from '@mui/lab/TimelineConnector'
import TimelineContent from '@mui/lab/TimelineContent'
import TimelineDot from '@mui/lab/TimelineDot'
import Typography from '@mui/material/Typography'

const debug = Debug('AI:ThreeBox')
debug(`loaded`)
const HAL = ({ steps, status }) => {
  return (
    <>
      {steps.map(({ type, status, tools, text }, stepsIndex) => {
        if (type === 'tools') {
          return (
            <div key={`steps-${stepsIndex}`}>
              {tools.map(({ cmd, args, output }, toolsIndex) => {
                return (
                  <TimelineItem key={`tools-${stepsIndex}-${toolsIndex}`}>
                    <TimelineSeparator>
                      <TimelineConnector sx={{ bgcolor: 'secondary.main' }} />
                      <TimelineDot color="secondary">
                        <ToolIcon />
                      </TimelineDot>
                      <TimelineConnector sx={{ bgcolor: 'secondary.main' }} />
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="h6" component="span">
                        {cmd}
                      </Typography>
                      <ObjectInspector name="args" data={args} />
                      <ObjectInspector name="output" data={output} />
                    </TimelineContent>
                  </TimelineItem>
                )
              })}
            </div>
          )
        } else if (type === 'message') {
          return (
            <TimelineItem key={`steps-${stepsIndex}`}>
              <TimelineSeparator>
                <TimelineConnector sx={{ bgcolor: 'secondary.main' }} />
                <TimelineDot color="secondary">
                  <HalIcon />
                </TimelineDot>
                <TimelineConnector sx={{ bgcolor: 'secondary.main' }} />
              </TimelineSeparator>
              <TimelineContent>
                <Typography variant="h6" component="span">
                  HAL
                </Typography>
                <br />
                <Markdown>{text}</Markdown>
              </TimelineContent>
            </TimelineItem>
          )
        } else {
          throw new Error(`unknown type ${type}`)
        }
      })}
    </>
  )
}
HAL.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string,
      status: PropTypes.string,
      tools: PropTypes.arrayOf(
        PropTypes.shape({
          callId: PropTypes.string,
          cmd: PropTypes.string,
          args: PropTypes.object,
          output: PropTypes.object,
        })
      ),
      text: PropTypes.string,
    })
  ),
  status: PropTypes.string,
}

const Dave = ({ text, status, url }) => (
  <TimelineItem>
    <TimelineSeparator onClick={() => window.open(url, '_blank')}>
      <TimelineDot color="primary">
        <DaveIcon />
      </TimelineDot>
    </TimelineSeparator>
    <TimelineContent>
      <Typography variant="h6" component="span">
        Dave
      </Typography>
      <br />
      <Markdown>{text}</Markdown>
    </TimelineContent>
  </TimelineItem>
)
Dave.propTypes = {
  text: PropTypes.string,
  status: PropTypes.string,
  url: PropTypes.string,
}

const Messages = ({ crisp }) => {
  if (!crisp || crisp.isLoading) {
    return
  }
  if (crisp.absolutePath !== '/.HAL') {
    throw new Error(`${crisp.absolutePath} !== '/.HAL'`)
  }
  const { messages, threadId, assistantId } = crisp.state
  const url = `https://platform.openai.com/playground?assistant=${assistantId}&mode=assistant&thread=${threadId}`
  return (
    <Timeline
      sx={{
        [`& .${timelineItemClasses.root}:before`]: {
          flex: 0,
          padding: 0,
        },
      }}
    >
      {messages.map(({ type, status, text, steps }, index) => {
        if (type === 'HAL') {
          return <HAL key={index} steps={steps} status={status} />
        }
        return <Dave key={index} text={text} status={status} url={url} />
      })}
    </Timeline>
  )
}
Messages.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default Messages
