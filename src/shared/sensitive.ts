export class SensitiveRequestGuard {
  private generation = 0
  private active = true
  begin() { const generation = ++this.generation; return this.active ? generation : -1 }
  clear() { this.generation++ }
  setActive(active: boolean) { this.active = active; if (!active) this.clear() }
  accepts(generation: number) { return this.active && generation === this.generation }
}
