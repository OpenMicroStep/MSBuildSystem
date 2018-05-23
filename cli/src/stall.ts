import { util } from '@openmicrostep/msbuildsystem.core';

export function stallDetector(limit: number) : { longest: number, last: number, mean(): number, stalls: number[], count: number, stop() : void } {
  let ret = {
    longest: 0,
    last: 0,
    mean() {
      return ret.count > 0 ? ret.sum / ret.count : 0;
    },
    sum: 0,
    count: 0,
    stalls: [] as number[],
    stop: stop
  };
  let t0 = util.now();
  let immediate = setImmediate(function tick() {
    let t = util.now();
    let dt = t - t0;
    ret.last = dt;
    if (dt > limit)
      ret.stalls.push(dt);
    ret.longest = Math.max(ret.longest, dt);
    ret.sum += dt;
    ret.count++;
    t0 = t;
    immediate = setImmediate(tick);
  });
  function stop() {
    clearImmediate(immediate);
  }
  return ret;
}

export function throttle(ms: number, fn: () => void) : (() => void) & { now() : void } {
  let last = Number.MIN_SAFE_INTEGER;
  let timer: NodeJS.Timer | undefined = undefined;
  function callnow() {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    last = util.now();
    fn();
  }
  return Object.assign(function throttled() {
    let delta = util.now() - last;
    if (delta >= ms)
      callnow();
    else if (!timer)
      timer = setTimeout(callnow, ms - delta);
  }, {
    now: callnow
  });
}
