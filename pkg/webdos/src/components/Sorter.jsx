import * as React from 'react'
import { api } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import ListItemText from '@mui/material/ListItemText'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import Chip from '@mui/material/Chip'
import ListItemIcon from '@mui/material/ListItemIcon'
import InboxIcon from '@mui/icons-material/LocationOn'
import Typography from '@mui/material/Typography'

import { FixedSizeList } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import Debug from 'debug'
import assert from 'assert-fast'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToParentElement } from '@dnd-kit/modifiers'

const debug = Debug('webdos:components:Sorter')

function renderRow(props) {
  let { index, style, data, isScrolling } = props
  const { items, mapping, selected } = data
  const id = items[index]
  const value = mapping.get(id, id)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })
  const sortableStyle = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const isSelected = selected === id
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={sortableStyle}>
      <Item
        id={id}
        value={value}
        index={index + 1}
        isDragging={isDragging}
        selected={isSelected}
      />
    </div>
  )
}
const Item = ({ id, value, index, isDragging, selected }) => {
  value = isDragging ? ' ' : value
  index = isDragging ? ' ' : index
  return (
    <ListItem key={id}>
      <ListItemButton selected={selected}>
        <ListItemIcon>
          <Chip label={index} />
        </ListItemIcon>
        <ListItemText primary={value} />
      </ListItemButton>
    </ListItem>
  )
}
Item.propTypes = {
  id: PropTypes.string,
  value: PropTypes.node,
  index: PropTypes.number,
  isDragging: PropTypes.bool,
  selected: PropTypes.string,
}
const sanitize = (value) => {
  const set = new Set()
  assert(
    value.every(({ id }) => !set.has(id) && set.add(id)),
    'ids must be unique'
  )
  if (!value.length) {
    return [
      {
        id: '0',
        value: <Typography fontStyle={'italic'}>(No customers)</Typography>,
      },
    ]
  }
  return value
}
export default function Sorter({ items, mapping, onSort, selected }) {
  debug('props', { items, mapping, onSort, selected })
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const [activeId, setActiveId] = React.useState()
  const onDragStart = ({ active }) => setActiveId(active.id)
  const onDragEnd = (event) => {
    debug('onDragEnd', event)
    setActiveId()
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id)
      const newIndex = items.indexOf(over.id)

      const nextItems = arrayMove(items, oldIndex, newIndex)
      onSort(nextItems)
    }
  }
  const data = { items, mapping, selected }
  return (
    <AutoSizer>
      {({ height, width }) => {
        return (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={items}
              strategy={verticalListSortingStrategy}
            >
              <FixedSizeList
                height={height}
                width={width}
                itemSize={46}
                itemCount={items.length}
                overscanCount={5}
                itemKey={(index, data) => data.items[index]}
                itemData={data}
              >
                {renderRow}
              </FixedSizeList>
            </SortableContext>
            <Overlay activeId={activeId} data={data} />
          </DndContext>
        )
      }}
    </AutoSizer>
  )
}
Sorter.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
  mapping: PropTypes.object,
  onSort: PropTypes.func,
  selected: PropTypes.string,
}
const Overlay = ({ activeId, data }) => {
  let child = null
  const { items, mapping } = data
  if (activeId) {
    child = <Item id={activeId} value={mapping.get(activeId, activeId)} />
  }
  return (
    <DragOverlay modifiers={[restrictToParentElement]}>{child}</DragOverlay>
  )
}
Overlay.propTypes = {
  activeId: PropTypes.string,
  data: PropTypes.array,
}
