import { useState } from 'react'
import { Image, PanResponder, View, useWindowDimensions } from 'react-native'
import { ImageZoom } from '../modules/images/viewer'
import { Button, Label } from '../ui'
export function ImageViewer({ uri, name, previous, next }: { uri: string; name: string; previous?: () => void; next?: () => void }) {
  const [model] = useState(() => new ImageZoom()); const [zoom, setZoom] = useState(model.value)
  const [width, setWidth] = useState(280); const { height: screenHeight } = useWindowDimensions(); const height = Math.min(360, screenHeight * 0.5)
  const [failed, setFailed] = useState(false)
  const responder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.numberActiveTouches > 1 || model.value.scale > 1 || Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: event => model.begin(event.nativeEvent.touches),
    onPanResponderMove: event => setZoom(model.move(event.nativeEvent.touches, width, height)),
    onPanResponderRelease: (_event, gesture) => { if (model.value.scale === 1 && Math.abs(gesture.dx) > 60 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) { if (gesture.dx < 0) next?.(); else previous?.() } },
    onPanResponderTerminationRequest: () => false,
  })
  return <><View accessibilityLabel="Image viewer" onLayout={event => setWidth(event.nativeEvent.layout.width)} {...responder.panHandlers} style={{ width: '100%', height, overflow: 'hidden', backgroundColor: '#101510' }}>
    <Image accessibilityLabel={name} source={{ uri }} onError={() => setFailed(true)} resizeMode="contain" style={{ width: '100%', height: '100%', transform: [{ translateX: zoom.x }, { translateY: zoom.y }, { scale: zoom.scale }] }} />
  </View>{failed && <Label>The image could not be loaded. Check your connection and reopen it.</Label>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button title="Zoom in" disabled={zoom.scale >= 4} onPress={() => setZoom(model.zoom(zoom.scale + 0.5, width, height))} />
      <Button title="Zoom out" disabled={zoom.scale <= 1} onPress={() => setZoom(model.zoom(zoom.scale - 0.5, width, height))} />
      <Button title="Reset zoom" onPress={() => setZoom(model.zoom(1, width, height))} />
      {previous && <Button title="Previous image" onPress={previous} />}{next && <Button title="Next image" onPress={next} />}
    </View>
  </>
}
