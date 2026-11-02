import { useCallback, useEffect, useState } from 'react'
import { firstLink } from '../modules/messenger/lib/text'
import { getLinkPreview } from '../modules/messenger/api'
import { useResource } from '../shared/useResource'
import { Button, Label } from '../ui'
import { View } from 'react-native'

export function ComposerPreview({ body }: { body: string }) {
  const url = firstLink(body); const [settled, setSettled] = useState<string | null>(null); const [dismissed, setDismissed] = useState<string | null>(null)
  useEffect(() => { const timer = setTimeout(() => setSettled(url), 400); return () => clearTimeout(timer) }, [url])
  const load = useCallback(() => settled && settled !== dismissed ? getLinkPreview(settled) : Promise.resolve(null), [settled, dismissed])
  const { value } = useResource(load)
  return value && url === settled && url !== dismissed ? <View style={{ padding: 8, gap: 4 }}><Label>{value.title || value.domain}</Label><Label>{value.domain}</Label><Button title="Hide link preview" onPress={() => setDismissed(url)} /></View> : null
}
