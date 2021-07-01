import React, { useState, useEffect } from 'react'

/**
 * Control navigation using useNavigation
 */

import { useNavigation } from '../hooks'

const Router = ({ children }) => {
  useNavigation()
  return <>{children}</>
}

export default Router
