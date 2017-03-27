
export function limitedDescription(value: any) : string {
  return JSON.stringify(value);
}

export function applyMixins(derivedCtor: Function, baseCtors: Function[]) {
    baseCtors.forEach(baseCtor => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
            derivedCtor.prototype[name] = baseCtor.prototype[name];
        });
    });
}

export function escapeRegExp(str) {
  return str.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
}

export function deepEqual(a, b) {
  if (a === b)
    return true;
  var ta = typeof a;
  if (ta !== typeof b || ta !== "object")
    return false;

  var aa = Array.isArray(a);
  var ab = Array.isArray(b);
  var i, len;
  if (aa !== ab)
    return false;
  if (aa) {
    if (a.length !== b.length)
      return false;
    for (i = 0, len = a.length; i < len; ++i)
      if (!deepEqual(a[i], b[i]))
         return false;
    return true;
  }

  var ka = Object.keys(a);
  var kb = Object.keys(b);
  if (ka.length !== kb.length)
    return false;

  ka.sort();
  kb.sort();
  for (i = 0, len = ka.length; i < len; ++i)
    if (ka[i] !== kb[i])
      return false;

  for (i = 0, len = ka.length; i < len; ++i) {
    var k = ka[i];
    if (!deepEqual(a[k], b[k]))
      return false;
  }

  return true;
}

export function once(task: (cb: (...args) => void) => void) {
  var obs: ((...args) => void)[] | null = <any[]>[];
  var args: IArguments | null = null;
  task(function() {
    args = arguments;
    var o = obs!;
    obs = null;
    for (var i = 0, len = o.length; i < len; ++i)
      o[i].apply(null, args);
  });
  return function(cb: (...args) => void) {
    if (obs)
      obs.push(cb);
     else
      cb.apply(null, args);
  };
}

export function pad(num, mask) {
  return (mask + num).slice(-Math.max(mask.length, (num + "").length));
}

const durationInNs = {
  mult        : [1e-6        , 1            , 1000    , 60000   , 3600000, 24 * 3600000],
  shortLabels : ["ns"        , "ms"         , "s"     , "m"     , "h"    , "d"         ],
  longLabels  : ["nanosecond", "millisecond", "second", "minute", "hour" , "day"       ],
};
const durationInMs = {
  mult        : [1            , 1000    , 60000   , 3600000, 24 * 3600000],
  shortLabels : ["ms"         , "s"     , "m"     , "h"    , "d"         ],
  longLabels  : ["millisecond", "second", "minute", "hour" , "day"       ],
};
const sizeInByte = {
  mult        : [1        , 1024 ** 1 , 1024 ** 2 , 1024 ** 3 , 1024 ** 4 ],
  shortLabels : ['B'      , 'KB'      , 'MB'      , 'GB'      , 'TB'      ],
  longLabels  : ['byte'   , 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'],
};
export class UnitFormatter {
  constructor(private units: { mult: number[], shortLabels: string[], longLabels: string[] }) {}

  static split(value: number, units: number[]) {
    let i = 0, len = units.length - 1, posValue = Math.abs(value);
    let steps = new Array<number>(units.length);
    for (; i < len; i++)
      steps[i] = Math.floor((posValue % units[i + 1]) / units[i]);
    steps[i] = Math.floor(posValue / units[i]) * (value < 0 || value === -0 ? -1 : +1);
    return steps;
  }

  components(value: number) : number[] {
    return UnitFormatter.split(value, this.units.mult);
  }
  short(value: number) {
    return this.components(value).reduceRight((pv, cv, ci) => cv ? `${pv && pv + ' '}${cv}${this.units.shortLabels[ci]}` : pv, "");
  }
  long(value: number) {
    return this.components(value).reduceRight((pv, cv, ci) => cv ? `${pv && pv + ' '}${cv} ${this.units.longLabels[ci]}${cv > 1 ? 's' : ''}` : pv, "");
  }
  simplifiedComponents(value: number, keep: number) : number[] {
    let ret = UnitFormatter.split(value, this.units.mult);
    let kept = 0;
    ret.reduceRight((pv, cv, ci) => {
      if (kept < keep && (cv > 0 || kept > 0))
        kept++;
      else if (kept === keep && pv.length > ci + 1) {
        if (cv >= 0.5 * this.units.mult[ci + 1] / this.units.mult[ci])
          pv[ci + 1]++;
        pv[ci] = 0;
        kept++;
      }
      else if (kept > keep) {
        pv[ci] = 0;
      }
      return pv;
    }, ret);
    return ret;
  }
  simplifiedShort(value: number, keep: number) {
    return this.simplifiedComponents(value, keep).reduceRight((pv, cv, ci) => cv ? `${pv && pv + ' '}${cv}${this.units.shortLabels[ci]}` : pv, "");
  }
  simplifiedLong(value: number, keep: number) {
    return this.simplifiedComponents(value, keep).reduceRight((pv, cv, ci) => cv ? `${pv && pv + ' '}${cv} ${this.units.longLabels[ci]}${cv > 1 ? 's' : ''}` : pv, "");
  }
}
export const Formatter = {
  duration: {
    nanosecond: new UnitFormatter(durationInNs),
    millisecond: new UnitFormatter(durationInMs),
  },
  size: {
    byte: new UnitFormatter(sizeInByte),
  },
};

export const now: () => number = (function() {
  if (typeof performance === "undefined") {
    if (typeof process === "object" && typeof process.hrtime === "function") {
      return function now_hrtime() {
        let t = process.hrtime();
        return (t[0] * 1e9 + t[1]) / 1e6;
      };
    }
    else {
      return Date.now;
    }
  }
  else {
    return performance.now;
  }
})();

export function performanceCounter(format: "long" | "short") : () => string;
export function performanceCounter() : () => number;
export function performanceCounter(format?: "long" | "short") : () => number | string {
  let t0 = now();
  return function() {
    var ms = now() - t0;
    return format ? Formatter.duration.millisecond[format](ms) : ms;
  };
}
