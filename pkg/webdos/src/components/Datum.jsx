import { api } from '@dreamcatcher-tech/interblock'
import React, { useEffect } from 'react'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import PropTypes from 'prop-types'
import DatumHOC from './DatumHOC'
import Debug from 'debug'
const debug = Debug('terminal:widgets:Datum')

const SchemaForm = ({
  complex,
  pending,
  viewOnly,
  formData,
  trySubmit,
  onChange,
  onSubmit,
}) => {
  let { schema, uiSchema } = complex.state
  if (schema === '..') {
    schema = complex.parent().state.template.schema
    uiSchema = complex.parent().state.template.uiSchema
  }
  uiSchema = { ...uiSchema, 'ui:submitButtonOptions': { norender: true } }
  const { title, ...noTitleSchema } = schema
  const noHidden = {
    ...noTitleSchema,
    properties: { ...noTitleSchema.properties },
  }
  Object.keys(noHidden.properties).forEach((key) => {
    if (uiSchema[key] && uiSchema[key]['ui:widget'] === 'hidden') {
      debug('removing hidden else rjsf loads slowly', key)
      delete noHidden.properties[key]
    }
  })
  let form
  useEffect(() => {
    if (trySubmit) {
      debug('trySubmit triggered')
      form.submit()
    }
  }, [trySubmit])
  return (
    <Form
      validator={validator}
      disabled={pending}
      readonly={viewOnly}
      schema={noHidden}
      uiSchema={uiSchema}
      formData={formData}
      onChange={onChange}
      onSubmit={onSubmit}
      ref={(_form) => (form = _form)}
    />
  )
}
SchemaForm.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  pending: PropTypes.bool,
  viewOnly: PropTypes.bool,
  formData: PropTypes.object,
  trySubmit: PropTypes.bool,
  onChange: PropTypes.func,
  onSubmit: PropTypes.func,
}

export default DatumHOC(SchemaForm)
