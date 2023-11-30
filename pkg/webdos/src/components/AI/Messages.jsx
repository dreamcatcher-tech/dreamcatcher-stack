import { ObjectInspector, chromeDark } from 'react-inspector'
import CircularProgress from '@mui/material/CircularProgress'
import { green } from '@mui/material/colors'
import { Crisp, system } from '@dreamcatcher-tech/interblock'
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

const { STATUS } = system.threads

const Progress = () => (
  <CircularProgress
    size={42}
    sx={{
      color: green[500],
      position: 'absolute',
      top: -5,
      left: -5,
      zIndex: 1,
    }}
  />
)

const HalThinking = ({ isTool = false }) => (
  <TimelineItem>
    <TimelineSeparator>
      <TimelineConnector sx={{ bgcolor: 'secondary.main' }} />
      <TimelineDot color="secondary" sx={{ position: 'relative' }}>
        {isTool ? <ToolIcon /> : <HalIcon />}
        <Progress />
      </TimelineDot>
      <TimelineConnector sx={{ bgcolor: 'secondary.main' }} />
    </TimelineSeparator>
    <TimelineContent>
      <Typography variant="h6" component="span">
        HAL
      </Typography>
      <Typography fontStyle="italic">(thinking...)</Typography>
    </TimelineContent>
  </TimelineItem>
)
HalThinking.propTypes = { isTool: PropTypes.bool }

const HAL = ({ steps, status }) => {
  if (!steps.length) {
    return <HalThinking />
  }
  return (
    <>
      {steps.map(({ type, status, tools, text }, stepsIndex) => {
        if (type === 'tools') {
          const key = `steps-${stepsIndex}`
          if (!tools.length) {
            return <HalThinking key={key} isTool />
          }
          return (
            <div key={`steps-${stepsIndex}`}>
              {tools.map(({ cmd, args, output }, toolsIndex) => {
                return (
                  <TimelineItem key={`tools-${stepsIndex}-${toolsIndex}`}>
                    <TimelineSeparator>
                      <TimelineConnector sx={{ bgcolor: 'secondary.main' }} />
                      <TimelineDot
                        color="secondary"
                        sx={{ position: 'relative' }}
                      >
                        <ToolIcon />
                        {status !== STATUS.HAL.DONE && <Progress />}
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
                <TimelineDot color="secondary" sx={{ position: 'relative' }}>
                  <HalIcon />
                  {status !== STATUS.HAL.DONE && <Progress />}
                </TimelineDot>
                <TimelineConnector sx={{ bgcolor: 'secondary.main' }} />
              </TimelineSeparator>
              <TimelineContent>
                <Typography variant="h6" component="span">
                  HAL
                </Typography>
                <br />
                {text ? (
                  <Markdown>{text}</Markdown>
                ) : (
                  <Typography fontStyle="italic">(writing...)</Typography>
                )}
              </TimelineContent>
            </TimelineItem>
          )
        } else {
          throw new Error(`unknown type ${type}`)
        }
      })}
      {status !== STATUS.HAL.DONE &&
        steps.every(({ status }) => status === STATUS.HAL.DONE) && (
          <HalThinking />
        )}
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
      <TimelineDot color="primary" sx={{ position: 'relative' }}>
        <DaveIcon />
        {status !== STATUS.USER.DONE && <Progress />}
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
