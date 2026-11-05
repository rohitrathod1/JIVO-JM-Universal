import { useRef, useState } from 'react'
import { Image, PanResponder, View } from 'react-native'
import { ImageZoom } from '../modules/images/viewer'
import { Label } from '../ui'
export function ImageViewer({ uri, name, previous, next }: { uri: string; name: string; previous?: () => void; next?: () => void }) {
  const [model] = useState(() => new ImageZoom()); const [zoom, setZoom] = useState(model.value)
  const [width, setWidth] = useState(280); const [height, setHeight] = useState(360)
  const [failed, setFailed] = useState(false)
  const pinching = useRef(false)
  /* PanResponder stores these callbacks; refs and the clock are accessed only during gestures. */
 /* eslint-disable react-hooks/refs */
 const responder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.numberActiveTouches > 1 || model.value.scale > 1 || Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: event => { pinching.current = event.nativeEvent.touches.length > 1; model.begin(event.nativeEvent.touches) },
    onPanResponderMove: event => { if (event.nativeEvent.touches.length > 1) pinching.current = true; setZoom(model.move(event.nativeEvent.touches, width, height)) },
    onPanResponderRelease: (_event, gesture) => { if (!pinching.current && model.value.scale === 1 && Math.abs(gesture.dx) > 60 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) { if (gesture.dx < 0) next?.(); else previous?.() } },
    onPanResponderTerminationRequest: () => false,
  })
 /* eslint-enable react-hooks/refs */
  return <><View accessible accessibilityLabel="Image viewer. Pinch to zoom. Swipe for the next or previous image." accessibilityActions={[{ name: 'increment', label: 'Zoom in' }, { name: 'decrement', label: 'Zoom out' }, ...(next ? [{ name: 'next', label: 'Next image' }] : []), ...(previous ? [{ name: 'previous', label: 'Previous image' }] : [])]} onAccessibilityAction={event => { const action = event.nativeEvent.actionName; if (action === 'increment' || action === 'decrement') setZoom(model.zoom(model.value.scale + (action === 'increment' ? 0.5 : -0.5), width, height)); else if (action === 'next') next?.(); else if (action === 'previous') previous?.() }} onLayout={event => { setWidth(event.nativeEvent.layout.width); setHeight(event.nativeEvent.layout.height) }} {...responder.panHandlers} style={{ width: '100%', flex: 1, overflow: 'hidden', backgroundColor: '#101510' }}>
    <Image accessibilityLabel={name} source={{ uri }} onError={() => setFailed(true)} resizeMode="contain" style={{ width: '100%', height: '100%', transform: [{ translateX: zoom.x }, { translateY: zoom.y }, { scale: zoom.scale }] }} />
  </View>{failed && <Label>The image could not be loaded. Check your connection and reopen it.</Label>}

  </>
}
