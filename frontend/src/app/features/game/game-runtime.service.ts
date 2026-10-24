import {Injectable, signal} from '@angular/core';

@Injectable()
export class GameRuntimeService {
  readonly running = signal(false);
  private frame = 0;

  start(): void {
    if (this.running()) return;
    this.running.set(true);
    const tick = (): void => {
      if (!this.running()) return;
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running.set(false);
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
