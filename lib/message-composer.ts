/** Collapsed until the field is focused, the attach row is open, or a draft/photo is already there. */
export function composerExpanded(state: { focused: boolean; tray: boolean; body: string; image: string }): boolean {
  return state.focused || state.tray || state.body.trim().length > 0 || state.image.trim().length > 0;
}

export function composerCanSend(state: { body: string; image: string }): boolean {
  return state.body.trim().length > 0 || state.image.trim().length > 0;
}
