/** Limitador de ventana deslizante (cliente y servidor). Lógica pura. */
export class RateLimiter {
  private stamps: number[] = [];
  constructor(
    private max: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** true si se permite la petición (y la cuenta). */
  tryTake(): boolean {
    const t = this.now();
    this.stamps = this.stamps.filter((s) => t - s < this.windowMs);
    if (this.stamps.length >= this.max) return false;
    this.stamps.push(t);
    return true;
  }

  reset(): void {
    this.stamps = [];
  }
}
