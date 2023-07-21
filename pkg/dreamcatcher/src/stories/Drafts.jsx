import React, { useState, useCallback, useEffect } from 'react'
import { Crisp } from '@dreamcatcher-tech/webdos'
import List from './List'
import PropTypes from 'prop-types'
import Fab from './Fab'
import { drafts } from './columns'
import Debug from 'debug'
const debug = Debug('dreamcatcher:Drafts')

export const Drafts = ({ crisp }) => {
  const onCreate = useCallback(
    () => crisp.actions.createDraftHeader().then((id) => crisp.cd(id)),
    [crisp]
  )
  return (
    <>
      <List crisp={crisp} columns={drafts} />
      <Fab type="create" disabled={crisp.isLoadingActions} onClick={onCreate} />
    </>
  )
}
Drafts.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  /**
   * Will cd into Drafts and create a new draft.
   */
  onCreate: PropTypes.func,
}
