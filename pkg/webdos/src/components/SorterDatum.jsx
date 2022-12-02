import { api } from '@dreamcatcher-tech/interblock'
import React, { useState } from 'react'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import Edit from '@mui/icons-material/Edit'
import Cancel from '@mui/icons-material/Cancel'
import Save from '@mui/icons-material/Save'
import { Sorter } from '.'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
import assert from 'assert-fast'
const debug = Debug('terminal:widgets:SorterDatum')

const SorterDatum = ({ complex, selected, onSelected }) => {
  let { schema, formData, uiSchema } = complex.state
  const [state, setState] = useState(complex.state)
  if (state !== complex.state) {
    debug('state changed', state, complex.state)
    setState(complex.state)
    setLiveFormData(formData)
    // TODO alert if changes not saved
  }
  const onChange = ({ formData }) => {
    debug(`onChange: `, formData)
    setLiveFormData(formData)
    // if any booleans changed, then apply the changes immediately
    // setDatum(formData)
  }
  const { order: items } = formData
  const mapping = apps.crm.utils.mapCustomers(complex)
  const onSort = (items) => {
    debug(`onSort: `, items)
  }

  // { items, mapping, onSort, onSelect, selected }
  const args = { items, mapping, onSort, onSelected, selected }
  return (
    <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title="Order"
        action={
          <>
            <IconButton aria-label="edit">
              <Edit color="primary" />
            </IconButton>
            <IconButton aria-label="save">
              <Save color="primary" />
            </IconButton>
            <IconButton aria-label="cancel">
              <Cancel color="secondary" />
            </IconButton>
          </>
        }
      />
      <CardContent sx={{ display: 'flex', flex: 1, minHeight: 300 }}>
        <Sorter {...args} />
      </CardContent>
    </Card>
  )
}
SorterDatum.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  selected: PropTypes.string,
  onSelected: PropTypes.func,
}
export default SorterDatum
