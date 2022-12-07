import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import ListItemText from '@mui/material/ListItemText'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import Chip from '@mui/material/Chip'
import ListItemIcon from '@mui/material/ListItemIcon'
import Typography from '@mui/material/Typography'
import { FixedSizeList } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import Debug from 'debug'
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
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToParentElement } from '@dnd-kit/modifiers'

const debug = Debug('webdos:components:Sorter')

function renderRow(props) {
  let { index, style, data, isScrolling } = props
  const { items, enrich, selected, readOnly, onSelected } = data
  const id = items[index]
  const value = enrich(id)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })
  const sortableStyle = { ...style }
  if (!readOnly) {
    sortableStyle.transform = CSS.Transform.toString(transform)
    sortableStyle.transition = transition
  }
  const isSelected = selected === id
  const onClick = () => {
    const toggleSelect = isSelected ? undefined : id
    onSelected(toggleSelect)
  }
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={sortableStyle}>
      <Item
        id={id}
        value={value}
        label={index + 1}
        isDragging={!readOnly && isDragging}
        isSelected={isSelected}
        onClick={onClick}
      />
    </div>
  )
}
const Item = ({ id, value, label, isDragging, isSelected, onClick }) => {
  value = isDragging ? ' ' : value
  label = isDragging ? ' ' : label
  return (
    <ListItem key={id} disablePadding>
      <ListItemButton selected={isSelected} onClick={onClick}>
        <ListItemIcon>
          <Chip label={label} />
        </ListItemIcon>
        <ListItemText primary={value} />
      </ListItemButton>
    </ListItem>
  )
}
Item.propTypes = {
  id: PropTypes.string,
  value: PropTypes.node,
  label: PropTypes.node,
  isDragging: PropTypes.bool,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func,
}
export default function Sorter({
  items,
  enrich,
  selected,
  onSort,
  onSelected,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const [activeId, setActiveId] = useState()
  const [lastSelected, setLastSelected] = useState()
  useEffect(() => {
    if (selected === undefined) {
      setLastSelected()
    }
    return () => setLastSelected(selected)
  }, [selected])
  useEffect(() => {
    if (!onSort) {
      return
    }
    if (lastSelected && selected && lastSelected !== selected) {
      debug('lastSelected', lastSelected, 'selected', selected)
      debug(enrich(lastSelected), enrich(selected))
      const lastSelectedIndex = items.indexOf(lastSelected)
      const selectedIndex = items.indexOf(selected)
      debug(lastSelectedIndex, selectedIndex)
      const adj = lastSelectedIndex < selectedIndex ? 1 : 0
      const nextItems = arrayMove(items, selectedIndex, lastSelectedIndex + adj)
      setLastSelected(selected)
      onSort(nextItems)
    }
  }, [lastSelected, selected, items])
  if (!items.length) {
    return <NoCustomers />
  }
  const onDragStart = ({ active }) => setActiveId(active.id)
  const onDragEnd = (event) => {
    if (!onSort) {
      return
    }
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
  const readOnly = !onSort
  const data = { items, enrich, selected, readOnly, onSelected }
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
                itemSize={Sorter.ITEM_SIZE}
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
  /**
   * Function to get enriched data based on an id.
   * Eg: turning the id into a service address.
   */
  enrich: PropTypes.object,
  /**
   * Id of the selected item.
   */
  selected: PropTypes.string,
  /**
   * Callback invoked when the list is sorted.
   */
  onSort: PropTypes.func,
  /**
   * Callback invoked when an item is selected.
   */
  onSelected: PropTypes.func,
}
Sorter.ITEM_SIZE = 46

const Overlay = ({ activeId, data }) => {
  const { items, enrich, readOnly } = data
  if (readOnly) {
    return null
  }
  let child = null
  const index = items.indexOf(activeId) + 1
  const value = enrich(activeId)
  if (activeId) {
    child = <Item id={activeId} value={value} label={index} />
  }
  return (
    <DragOverlay modifiers={[restrictToParentElement]}>{child}</DragOverlay>
  )
}
Overlay.propTypes = {
  activeId: PropTypes.string,
  data: PropTypes.object,
}
const NoCustomers = () => {
  const value = <Typography fontStyle={'italic'}>(No customers)</Typography>
  return (
    <ListItem>
      <ListItemButton>
        <ListItemIcon />
        <ListItemText primary={value} />
      </ListItemButton>
    </ListItem>
  )
}
