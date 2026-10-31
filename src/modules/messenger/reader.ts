export function arrivalBehavior(nearBottom: boolean, hasMoreAfter: boolean, previous: number, current: number) {
  if (current <= previous) return 'none'
  return nearBottom && !hasMoreAfter ? 'follow' : 'indicate'
}
