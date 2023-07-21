const columns = [
  {
    width: 60,
    disableColumnMenu: true,
    hideable: false,
    sortable: false,
    resizable: false,
    align: 'center',
    renderCell: (params) => <img src={params.value} height={45} />,
  },
  { flex: 1 },
  {},
  {
    width: 150,
    type: 'dateTime',
    valueFormatter: (params) => {
      if (typeof params.value !== 'number') {
        return
      }
      return new Date(params.value).toDateString()
    },
  },
]

export const packets = columns
export const drafts = [{}, ...columns]
