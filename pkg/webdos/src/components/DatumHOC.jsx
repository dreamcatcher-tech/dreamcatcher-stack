import PropTypes from 'prop-types'
import equals from 'fast-deep-equal'
import { Crisp } from '@dreamcatcher-tech/interblock'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import React, { useState, useEffect } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CardHeader from '@mui/material/CardHeader'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Edit from '@mui/icons-material/Edit'
import Cancel from '@mui/icons-material/Cancel'
import Save from '@mui/icons-material/Save'
import { Actions } from '.'
import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('terminal:widgets:DatumHOC')

export default function DatumHOC(Child) {
  const theme = createTheme()
  const noDisabled = createTheme({
    palette: { text: { disabled: '0 0 0' } },
  })
  const Datum = ({ crisp, collapsed, viewOnly, onEdit, editing, ...props }) => {
    // TODO verify the covenant is a datum
    // TODO verify the chain children match the schema children
    assert(!viewOnly || !editing, 'viewOnly and editing are mutually exclusive')

    const [formData, setFormData] = useState(crisp.state.formData)
    const [isPending, setIsPending] = useState(false)
    const [isEditing, setIsEditing] = useState(editing)
    const [expanded, setExpanded] = useState(!collapsed)
    const [startingState, setStartingState] = useState(crisp.state)
    if (!equals(startingState, crisp.state)) {
      debug('state changed', startingState, crisp.state)
      setStartingState(crisp.state)
      setFormData(crisp.state.formData)
      // TODO alert if changes not saved
    }
    const isDirty = !equals(formData, crisp.state.formData)
    debug('isDirty', isDirty)
    const onChange = ({ formData }) => {
      debug(`onChange: `, formData)
      setFormData(formData)
    }
    const onIsEditing = (isEditing) => {
      setIsEditing(isEditing)
      onEdit && onEdit(isEditing)
    }

    const onSubmit = () => {
      debug('onSubmit', formData)
      setIsPending(true)
      crisp.ownActions.set(formData).then(() => {
        setIsPending(false)
        onIsEditing(false)
      })
    }
    const [trySubmit, setTrySubmit] = useState(false)
    useEffect(() => {
      if (trySubmit) {
        setTrySubmit(false)
        debug('trySubmit lowered')
      }
    }, [trySubmit])
    const onSave = (e) => {
      debug('onSave', e)
      e.stopPropagation()
      setTrySubmit(true)
    }
    const onCancel = (e) => {
      debug('onCancel', e)
      e.stopPropagation()
      onIsEditing(false)
      if (isDirty) {
        setFormData(crisp.state.formData)
      }
    }
    const Editing = (
      <>
        <IconButton onClick={onSave}>
          <Save color={isPending ? 'disabled' : 'primary'} />
        </IconButton>
        <IconButton onClick={onCancel}>
          <Cancel color={isPending ? 'disabled' : 'secondary'} />
        </IconButton>
      </>
    )
    const onStartEdit = (e) => {
      debug('onEdit', e)
      setExpanded(true)
      e.stopPropagation()
      onIsEditing(true)
    }
    const Viewing = (
      <IconButton onClick={onStartEdit}>
        <Edit color="primary" />
      </IconButton>
    )
    const Blank = (
      <IconButton>
        <Edit color="disabled" />
      </IconButton>
    )
    const onExpand = (e, isExpanded) => {
      if (isEditing) {
        if (isDirty) {
          return
        }
        onCancel(e)
      }
      setExpanded(isExpanded)
    }
    let { schema = {} } = crisp.state
    if (schema === '..' && crisp.parent) {
      schema = crisp.parent.state.template.schema
    }
    const { title } = schema
    return (
      <Card>
        <Accordion expanded={expanded} onChange={onExpand}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon fontSize="large" />}
            sx={{ display: 'flex' }}
          >
            <CardHeader title={title} sx={{ p: 0, flexGrow: 1 }} />
            {isEditing ? Editing : viewOnly ? Blank : Viewing}
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column' }}>
            <ThemeProvider theme={isEditing ? theme : noDisabled}>
              <Child
                {...{
                  crisp,
                  pending: isPending,
                  viewOnly: !isEditing,
                  onChange,
                  formData,
                  trySubmit,
                  onSubmit,
                  ...props,
                }}
              />
              {/* <Actions crisp={crisp} exclude={['set']}></Actions> */}
            </ThemeProvider>
          </AccordionDetails>
        </Accordion>
      </Card>
    )
  }
  Datum.propTypes = {
    /**
     * The crisp instance backing this Datum
     */
    crisp: PropTypes.instanceOf(Crisp),
    /**
     * Show no edit button - all fields are readonly
     */
    viewOnly: PropTypes.bool,
    /**
     * Notify when the component starts and stops editing
     */
    onEdit: PropTypes.func,
    /**
     * Used in testing to start the component in collapsed mode
     */
    collapsed: PropTypes.bool,
    /**
     * Used in testing to start the component in editing mode
     */
    editing: PropTypes.bool,
  }
  return Datum
}
