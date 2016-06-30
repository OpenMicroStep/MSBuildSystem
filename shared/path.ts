
export function basename(path: string) : string {
  var idx = path.length, c;
  while (idx > 0 && (c= path[--idx]) !== '/' && c !== '\\');
  return (c === '/' || c === '\\') ? path.substring(idx + 1) : path;
}
export function extname(path: string) : string {
  var idx = path.length, c;
  while (idx > 1 && (c= path[--idx]) !== '.' && c !== '/' && c !== '\\');
  return idx > 0 && c === '.' ? path.substring(idx) : '';
}
