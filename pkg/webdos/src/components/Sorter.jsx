import * as React from 'react'
import PropTypes from 'prop-types'
import { Box, ListItemText, ListItem, ListItemButton } from '@mui/material'
import { FixedSizeList } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'

function renderRow(props) {
  // export interface ListChildComponentProps<T = any> {
  //     index: number;
  //     style: CSSProperties;
  //     data: T;
  //     isScrolling?: boolean | undefined;
  // }
  const { index, style, data, isScrolling } = props
  const row = data[index]
  const { path } = row
  return (
    <ListItem style={style} key={row.path} component="div" disablePadding>
      <ListItemButton>
        <ListItemText primary={path} />
      </ListItemButton>
    </ListItem>
  )
}
export default function Sorter({ items, onSort, readonly }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        minWidth: 200,
        minHeight: 350,
        height: 1,
        bgcolor: 'background.paper',
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
  /**
   * Array of items to be rendered.
   * Must at least include `path` key.
   */
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  /**
   * Callback for whenever sorting has occured.
   * If this is not supplied, then the sorting functionality is disabled,
   * which can be used to present a static view.
   */
  onSort: PropTypes.func,
  readonly: PropTypes.bool,
}

// import { SortableContainer, SortableElement } from 'react-sortable-hoc'
// import { List } from 'react-virtualized'
// import { connect } from 'react-redux'

// export const SortableItem = SortableElement(
//   ({
//     color,
//     number,
//     style,
//     value,
//     isSelected,
//     isSequenceMode,
//     onMouseDown,
//   }) => {
//     const iconStyle = {}
//     const icon = (
//       <Label className="pull-right" style={iconStyle}>
//         {number}
//       </Label>
//     )

//     const originalStyle = {
//       border: '1px solid gray',
//       padding: '0.5rem 1rem',
//       cursor: 'move',
//       fontSize: '1em',
//       fontWeight: 'bold',
//       height: style.height,
//       position: 'absolute',
//       left: 0,
//       top: style.top,
//       width: '100%',
//       backgroundColor: 'white',
//     }
//     const selectedStyle = {
//       ...originalStyle,
//       backgroundColor: 'pink',
//     }
//     const sequencedStyle = {
//       ...originalStyle,
//       backgroundColor: 'lightblue',
//     }
//     const modifiedStyle =
//       isSequenceMode && isSelected
//         ? sequencedStyle
//         : isSelected
//         ? selectedStyle
//         : originalStyle

//     return (
//       <div
//         style={modifiedStyle}
//         className="noselect"
//         onMouseDown={() => onMouseDown(value)}
//       >
//         {value.address.street + ', ' + value.address.suburb}
//         {icon}
//       </div>
//     )
//   }
// )

// export const SortableList = SortableContainer(
//   ({
//     order,
//     selectedSector,
//     lut,
//     color = 'black',
//     displayLocationIds = [],
//     selectedIds = [],
//     isSequenceMode,
//     locations,
//     onMouseDown,
//     width,
//     height,
//   }) => {
//     return (
//       <List
//         rowHeight={30}
//         rowRenderer={({ index, key, style }) => {
//           let loc = displayLocationIds[index]
//           const isSelected = selectedIds.includes(loc)
//           return (
//             <SortableItem
//               key={key}
//               index={index}
//               color={color}
//               number={index + 1}
//               style={style}
//               value={locations[loc].doc}
//               isSelected={isSelected}
//               isSequenceMode={isSequenceMode}
//               disabled={isSequenceMode}
//               onMouseDown={onMouseDown}
//             />
//           )
//         }}
//         rowCount={displayLocationIds.length}
//         width={width}
//         height={height}
//       />
//     )
//   }
// )

// SortableList.propTypes = {
//   order: PropTypes.array.isRequired,
//   selectedSector: PropTypes.object,
//   lut: PropTypes.object.isRequired,
//   color: PropTypes.string,
//   displayLocationIds: PropTypes.array,
//   selectedIds: PropTypes.array,
//   isSequenceMode: PropTypes.bool.isRequired,
//   locations: PropTypes.object.isRequired,
//   onMouseDown: PropTypes.func.isRequired,
//   onSortEnd: PropTypes.func.isRequired,
//   width: PropTypes.number.isRequired,
//   height: PropTypes.number.isRequired,
// }
