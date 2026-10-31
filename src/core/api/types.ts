/** A page of an admin list (page-number). Conversations will use cursors, never this. */
export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** How every person appears in API responses. */
export interface Person {
  id: string
  name: string
  email: string
  is_active: boolean
}
