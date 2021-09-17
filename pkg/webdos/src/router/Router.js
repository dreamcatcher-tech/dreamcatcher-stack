import React, { useState, useEffect } from 'react'

/**
 * Control navigation using useNavigation
 */

import { useNavigation } from '../hooks'

const Router = ({ children }) => {
  // TODO place the root context here, which all switch statements depend upon
  useNavigation()
  return children
}

export default Router
