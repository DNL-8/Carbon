export function navigateTabs(event: KeyboardEvent, activate = true) {
  const list = event.currentTarget as HTMLElement
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')]
  const index = tabs.indexOf(event.target as HTMLButtonElement)
  if (index < 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  let next: number
  switch (event.key) {
    case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break
    case 'ArrowRight': next = (index + 1) % tabs.length; break
    case 'Home': next = 0; break
    case 'End': next = tabs.length - 1; break
    default: return
  }
  event.preventDefault()
  tabs[next]?.focus()
  if (activate && next !== index) tabs[next]?.click()
}
