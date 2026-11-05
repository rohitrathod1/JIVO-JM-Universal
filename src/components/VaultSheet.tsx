import { Children, isValidElement, type ComponentProps, type ReactNode } from 'react'
import { Label } from '../ui'
import { Sheet } from './Sheet'

/** Vault dialogs share a bottom anchored frame and a labelled close control. */
export function VaultSheet({ children, title, ...props }: ComponentProps<typeof Sheet>) {
  const content = Children.toArray(children)
  const first = content[0]
  if (!title && isValidElement<{ large?: boolean; children?: ReactNode }>(first) && first.type === Label && first.props.large && typeof first.props.children === 'string') {
    title = first.props.children
    content.shift()
  }
  return <Sheet {...props} title={title} bottomAligned stableForm={false}>{content}</Sheet>
}
