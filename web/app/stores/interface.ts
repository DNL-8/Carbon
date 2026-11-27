import { defineStore } from 'pinia'

export const useInterfaceStore = defineStore('interface', {
  state: () => ({
    arsenalFilter: 'owned' as 'owned' | 'available' | 'all',
  }),
})
