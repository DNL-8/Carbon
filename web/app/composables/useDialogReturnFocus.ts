export function useDialogReturnFocus() {
  let trigger: HTMLElement | undefined
  function remember(event: MouseEvent) {
    trigger = event.currentTarget as HTMLElement
  }
  function onCloseAutoFocus(event: Event) {
    if (!trigger?.isConnected || trigger.matches(':disabled')) return
    event.preventDefault()
    trigger.focus()
    trigger = undefined
  }
  return { remember, content: { onCloseAutoFocus } }
}
