
export function basename(path: string) : string {
  let idx = path.length;
  let c: string | undefined;
  while (idx > 0 && (c = path[--idx]) !== '/' && c !== '\\');
  return (c === '/' || c === '\\') ? path.substring(idx + 1) : path;
}
export function extname(path: string) : string {
  let idx = path.length;
  let c: string | undefined;
  while (idx > 1 && (c= path[--idx]) !== '.' && c !== '/' && c !== '\\');
  return idx > 0 && c === '.' ? path.substring(idx) : '';
}
