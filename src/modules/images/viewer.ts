export interface TouchPoint { pageX: number; pageY: number }
export interface ZoomState { scale: number; x: number; y: number }
const center = (points: readonly TouchPoint[]) => ({ x: points.reduce((n, p) => n + p.pageX, 0) / points.length, y: points.reduce((n, p) => n + p.pageY, 0) / points.length })
const distance = (points: readonly TouchPoint[]) => points.length < 2 ? 0 : Math.hypot(points[1].pageX - points[0].pageX, points[1].pageY - points[0].pageY)
export class ImageZoom {
  value: ZoomState = { scale: 1, x: 0, y: 0 }
  private start = this.value
  private points: TouchPoint[] = []
  begin(points: readonly TouchPoint[]) { this.points = points.map(point => ({ ...point })); this.start = { ...this.value } }
  zoom(scale: number, width: number, height: number, x = this.value.x, y = this.value.y) {
    scale = Math.min(4, Math.max(1, scale))
    const clamp = (value: number, size: number) => Math.max(-size * (scale - 1) / 2, Math.min(size * (scale - 1) / 2, value))
    this.value = { scale, x: clamp(x, width), y: clamp(y, height) }; return this.value
  }
  move(points: readonly TouchPoint[], width: number, height: number) {
    if (!points.length) return this.value
    if (points.length !== this.points.length) { this.begin(points); return this.value }
    const from = center(this.points); const to = center(points); const initial = distance(this.points)
    const scale = initial > 0 ? this.start.scale * distance(points) / initial : this.start.scale
    return this.zoom(scale, width, height, this.start.x + to.x - from.x, this.start.y + to.y - from.y)
  }
}
