import type { CosmeticPoint } from './gameCosmeticEvents';

type FlightSample = CosmeticPoint & { at: number };

export class FlightHistory {
  private readonly history: FlightSample[] = Array.from({ length: 56 }, () => ({ x: 0, y: 0, at: 0 }));
  private readonly points: CosmeticPoint[] = Array.from({ length: 15 }, () => ({ x: 0, y: 0 }));
  private next = 0;
  private count = 0;
  private flight = -Infinity;

  reset() {
    this.next = 0;
    this.count = 0;
    this.flight = -Infinity;
  }

  record(flight: number, at: number, x: number, y: number, origin: CosmeticPoint) {
    if (flight !== this.flight) {
      this.reset();
      this.flight = flight;
      // The launch position is a real sample even if the renderer misses the first frame.
      this.write(flight, origin.x, origin.y);
    }
    const previous = this.at(this.count - 1);
    if (at - previous.at >= 8) this.write(at, x, y);
  }

  private write(at: number, x: number, y: number) {
    const point = this.history[this.next];
    point.at = at;
    point.x = x;
    point.y = y;
    this.next = (this.next + 1) % this.history.length;
    this.count = Math.min(this.history.length, this.count + 1);
  }

  private at(index: number) {
    return this.history[(this.next - this.count + index + this.history.length) % this.history.length];
  }

  sample(now: number, lifetime: number, head: CosmeticPoint): CosmeticPoint[] {
    if (!this.count || now <= this.flight) return [];
    const tailAt = Math.max(now - lifetime, this.at(0).at);
    let j = 0;
    for (let i = 0; i < this.points.length; i += 1) {
      const time = tailAt + (now - tailAt) * i / (this.points.length - 1);
      while (j + 1 < this.count && this.at(j + 1).at <= time) j += 1;
      const a = this.at(j);
      const b = j + 1 < this.count ? this.at(j + 1) : head;
      const end = j + 1 < this.count ? this.at(j + 1).at : now;
      const t = end > a.at ? (time - a.at) / (end - a.at) : 0;
      this.points[i].x = a.x + (b.x - a.x) * t;
      this.points[i].y = a.y + (b.y - a.y) * t;
    }
    return this.points;
  }
}
