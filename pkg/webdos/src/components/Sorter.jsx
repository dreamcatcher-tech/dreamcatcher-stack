import * as React from 'react'
import { api } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import {
  Box,
  ListItemText,
  ListItem,
  ListItemButton,
  Typography,
} from '@mui/material'
import { FixedSizeList } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import Debug from 'debug'
const debug = Debug('webdos:components:Sorter')

function renderRow(props) {
  // export interface ListChildComponentProps<T = any> {
  //     index: number;
  //     style: CSSProperties;
  //     data: T;
  //     isScrolling?: boolean | undefined;
  // }
  const { index, style, data, isScrolling } = props
  const row = data[index]
  const { path, address } = row
  return (
    <ListItem style={style} key={path} component="div" disablePadding>
      <ListItemButton>
        <ListItemText primary={address} />
      </ListItemButton>
    </ListItem>
  )
}
export default function Sorter({ complex, onSort }) {
  const { order } = complex.state.formData
  const customers = complex.tree.child('customers')
  const items = React.useMemo(() => {
    return order.map((custNo) => {
      const customer = customers.child(custNo)
      const address = customer.state.formData.serviceAddress
      return { path: custNo, address }
    })
  }, [order, customers])
  if (!items.length) {
    items.push({
      path: 0,
      address: <Typography fontStyle={'italic'}>(No customers)</Typography>,
    })
  }
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        minWidth: 200,
        minHeight: 350,
        height: 1,
      }}
    >
      <AutoSizer>
        {({ height, width }) => {
          return (
            <FixedSizeList
              height={height}
              width={width}
              itemSize={46}
              itemCount={items.length}
              overscanCount={5}
              itemKey={(index, data) => data[index].path}
              itemData={items}
            >
              {renderRow}
            </FixedSizeList>
          )
        }}
      </AutoSizer>
    </Box>
  )
}
Sorter.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  onSort: PropTypes.func,
}
