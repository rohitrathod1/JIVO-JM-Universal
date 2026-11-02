import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Image, Linking, PanResponder, Text, View } from 'react-native'
import { origin } from '../core/api/client'
import { mapTiles, pointAt, worldPoint, type LatLng } from '../modules/messenger/location/model'
import { tileHeaders } from '../modules/messenger/location/tileHeaders'
import { Button, useColors } from '../ui'

/** Shared OSM tile view. Requests stay on JM's authenticated map proxy on every platform. */
export function LocationMap({ center, initialZoom = 16, interactive = false, onMove, height = 210, overlay }: { center: LatLng; initialZoom?: number; interactive?: boolean; onMove?: (point: LatLng) => void; height?: number; overlay?: ReactNode }) {
  const c = useColors(); const [width, setWidth] = useState(320); const [zoom, setZoom] = useState(initialZoom)
  const [drag, setDrag] = useState<{ base: LatLng; point: LatLng } | null>(null); const view = drag?.base === center ? drag.point : center
  const [headers, setHeaders] = useState<Record<string, string> | undefined>()
  const [ready, setReady] = useState(false); const [error, setError] = useState(false)
  const current = useRef({ view, center, zoom, onMove }); const start = useRef({ x: 0, y: 0, zoom })
  useEffect(() => { current.current = { view, center, zoom, onMove } }, [view, center, zoom, onMove])
  useEffect(() => { let alive = true; void tileHeaders().then(value => { if (alive) { setHeaders(value); setReady(true) } }).catch(() => { if (alive) setError(true) }); return () => { alive = false } }, [])
  // PanResponder stores these callbacks; ref reads occur only when a gesture fires.
  // eslint-disable-next-line react-hooks/refs
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_event, gesture) => interactive && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
    onMoveShouldSetPanResponder: (_event, gesture) => interactive && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => { const value = current.current; start.current = { ...worldPoint(value.view, value.zoom), zoom: value.zoom } },
    onPanResponderMove: (_event, gesture) => setDrag({ base: current.current.center, point: pointAt(start.current.x - gesture.dx, start.current.y - gesture.dy, start.current.zoom) }),
    onPanResponderRelease: (_event, gesture) => { const point = pointAt(start.current.x - gesture.dx, start.current.y - gesture.dy, start.current.zoom); setDrag({ base: current.current.center, point }); current.current.onMove?.(point) },
    onPanResponderTerminationRequest: () => false,
  }), [interactive])
  const tiles = mapTiles(view, zoom, width, height)
  const zoomBy = (amount: number) => { setZoom(value => Math.max(2, Math.min(19, value + amount))); setError(false); onMove?.(view) }
  return <View style={{ gap: 4 }}>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height, overflow: 'hidden', borderRadius: 12, backgroundColor: c.neutral }} {...pan.panHandlers} accessibilityLabel={interactive ? 'Move map to choose a location' : 'Location map'}>
      {ready && tiles.map(tile => <Image key={tile.key} accessible={false} source={{ uri: `${origin}/api/jm/maps/tiles/${tile.zoom}/${tile.x}/${tile.y}.png`, headers }} style={{ position: 'absolute', width: 256, height: 256, left: tile.left, top: tile.top }} onError={() => setError(true)} />)}
      <View pointerEvents="none" style={{ position: 'absolute', top: height / 2 - 31, left: width / 2 - 12, width: 24, height: 30, backgroundColor: '#ef4444', borderColor: '#fff', borderWidth: 3, borderTopLeftRadius: 15, borderTopRightRadius: 15, borderBottomLeftRadius: 15, transform: [{ rotate: '-45deg' }] }} />
      {interactive && <View style={{ position: 'absolute', top: 8, right: 8, gap: 4 }}><Button title="+" accessibilityLabel="Zoom in map" variant="secondary" disabled={zoom === 19} onPress={() => zoomBy(1)} /><Button title="−" accessibilityLabel="Zoom out map" variant="secondary" disabled={zoom === 2} onPress={() => zoomBy(-1)} /></View>}
      {error && <Text style={{ position: 'absolute', bottom: 4, left: 6, right: 6, backgroundColor: c.panel, color: c.text, fontSize: 11 }}>Map tiles are unavailable. Search or use the coordinates below.</Text>}
      {overlay}
    </View>
    <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => {})} style={{ color: c.muted, fontSize: 10, textAlign: 'right', alignSelf: 'flex-end', textDecorationLine: 'none', cursor: 'pointer' }}>© OpenStreetMap contributors</Text>
  </View>
}
