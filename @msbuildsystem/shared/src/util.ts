
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

export function formatUnits(value: number, definition: {v?: number}[], options?: { format?: 'short' | 'long', units?: number }) : string {
  var steps, i, len, v, n, d, c;
  var format = options && options.format || 'long';
  var units = options && options.units || 0;
  if (units <= 0)
    units = definition.length;
  n = Math.round(value);
  steps = [];
  for (i = 0, len = definition.length - 1; i < len && n >= (v = definition[i].v); i++) {
    d = Math.floor(n / v);
    c = n - d * v;
    if (c > 0)
      steps.push(c + definition[i][format]);
    n = d;
  }
  if (n > 0)
    steps.push(n + definition[i][format]);
  var ret = "";
  units = Math.max(0, steps.length - units);
  for (i = steps.length; i > units; )
    ret += (ret.length ? " " : "") + steps[--i];
  return ret;
}

var durationUnits = [
  {v: 1000, short: 'ms', long: ' milliseconds'},
  {v:   60, short: 's' , long: ' seconds'},
  {v:   60, short: 'm' , long: ' minutes'},
  {v:   24, short: 'h' , long: ' hours'},
  {v:    0, short: 'd' , long: ' days'},
];
export function formatDuration(durationInMs: number, options?: { format?: 'short' | 'long', units?: number }) : string {
  return formatUnits(durationInMs, durationUnits, options);
}

var byteUnits = [
  {v: 1024, short: 'B' , long: ' bytes'},
  {v: 1024, short: 'KB', long: ' kilobytes'},
  {v: 1024, short: 'MB', long: ' megabytes'},
  {v: 1024, short: 'GB', long: ' gigabytes'},
  {v: 1024, short: 'TB', long: ' terabytes'}
];
export function formatSize(sizeInBytes, options?: { format?: 'short' | 'long', units?: number }) {
  return formatUnits(sizeInBytes, byteUnits, options);
}
