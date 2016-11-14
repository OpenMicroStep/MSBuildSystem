export class Barrier {
  protected action: (() => void) | undefined;
  protected counter: number;

  constructor(public name: string, counter: number = 0) {
    this.action = undefined;
    this.counter = counter + 1;
  }

  inc() {
    if (this.counter > 0)
      this.counter++;
  }

  dec() {
    if (this.counter > 0 && --this.counter === 0)
      this.break();
  }

  break() {
    if (this.counter < 0)
      return; // you can broke a barrier only once

    this.counter = -1;
    if (this.action) {
      this.counter = -2;
      let action = this.action;
      action();
      this.action = undefined;
    }
  }

  isPending() {
    return this.counter > 0;
  }

  decCallback() {
    return () => { this.dec(); };
  }

  endWith(action: () => any) {
    if (this.counter === -1) {
      // the barrier is broken by force, do the action
      action();
      this.counter = -2;
    }
    else {
      this.action = action;
      this.dec();
    }
  }
}
