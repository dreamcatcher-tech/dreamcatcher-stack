import Fab from './Fab'
export default {
  title: 'Dreamcatcher/Fab',
  component: Fab,
  args: {
    onClick: () => {
      console.log('Fab click')
    },
  },
}

export const Create = { args: { type: 'create' } }
export const Mint = { args: { type: 'mint' } }
export const Fund = { args: { type: 'fund' } }
export const Dispute = { args: { type: 'dispute' } }
export const Solve = { args: { type: 'solve' } }
export const Disabled = { args: { type: 'solve', disabled: true } }
