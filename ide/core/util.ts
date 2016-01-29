export function pathBasename(path: string) : string
{
  var idx = path.length, c;
  while (idx > 0 && (c= path[--idx]) !== '/' && c !== '\\');
  return (c === '/' || c === '\\') ? path.substring(idx + 1) : path;
}

export function splitPath(path) : { directory: string, name: string, extension: string }
{
  var idx = path.length, extidx, c;
  var dir, name, ext;
  while (idx > 0 && (c= path[--idx]) !== '/' && c !== '\\' && c !== '.');
  if (c === '.') {
    ext = path.substring(idx + 1);
    extidx = idx;
    while (idx > 0 && (c= path[--idx]) !== '/' && c !== '\\');
  }
  else {
    extidx = path.length;
    ext = "";
  }
  if (c === '/' || c === '\\') {
    name = path.substring(idx + 1, extidx);
    dir = path.substring(0, idx);
  }
  else {
    name = path.substring(0, extidx);
    dir = "";
  }
  return { directory: dir, name: name, extension: ext };
}

export function stringDistance(searchStr: string, str: string)
{
  var searchPos, searchLen, strPos, strLen, distance;

  str = str.toLowerCase();
  searchLen = searchStr.length;
  strLen = str.length;

  if (searchLen === 0)
    return 0;

  if ((distance = str.indexOf(searchStr)) != -1) {
    return distance + str.length - searchStr.length;
  }

  distance = 0;
  strPos = 0;
  searchPos = 0;


  while(strPos < strLen) {
    if (searchPos == searchLen)
      distance += 1;
    else if (searchStr[searchPos] == str[strPos])
      searchPos++;
    else if (searchPos == 0)
      distance += 1;
    else
      distance += 1000;
    strPos++;
  }

  return searchPos == searchLen ? distance : Number.MAX_SAFE_INTEGER;
}

function createHighlightedElement(str: string) : HTMLElement {
  var el = document.createElement('i');
  el.textContent = str;
  return el;
}

export function appendStringDistanceToElement(element: HTMLElement, searchStr: string, str: string) {
  var searchPos, searchLen, strPos, strLen, idx, h, lcstr;

  lcstr = str.toLowerCase();
  searchLen = searchStr.length;
  strLen = str.length;

  if (searchLen === 0) {
    element.appendChild(document.createTextNode(str));
    return;
  }

  if ((idx = lcstr.indexOf(searchStr)) != -1) {
    if (idx > 0)
      element.appendChild(document.createTextNode(str.substring(0, idx)));
    element.appendChild(createHighlightedElement(str.substr(idx, searchLen)));
    if (idx + searchLen < strLen)
      element.appendChild(document.createTextNode(str.substring(idx + searchLen)));
    return;
  }

  strPos = 0;
  searchPos = 0;
  idx = 0;
  h = false;

  while(strPos < strLen) {
    if (searchPos != searchLen && searchStr[searchPos] == lcstr[strPos]) {
      searchPos++;
      if (h === false) {
        if (strPos > idx)
          element.appendChild(document.createTextNode(str.substring(idx, strPos)));
        idx = strPos;
        h = true;
      }
    }
    else if (h === true) {
      element.appendChild(createHighlightedElement(str.substring(idx, strPos)));
      idx = strPos;
      h = false;
    }
    strPos++;
  }
  if (strPos > idx)
    element.appendChild(document.createTextNode(str.substring(idx, strPos)));
}

export function scrollIntoViewIfNeeded(element) {
  var parent = element.parentNode,
      parentComputedStyle = window.getComputedStyle(parent, null),
      parentBorderTopWidth = parseInt(parentComputedStyle.getPropertyValue('border-top-width')),
      parentBorderLeftWidth = parseInt(parentComputedStyle.getPropertyValue('border-left-width')),
      overTop = element.offsetTop - parent.offsetTop < parent.scrollTop,
      overBottom = (element.offsetTop - parent.offsetTop + element.clientHeight - parentBorderTopWidth) > (parent.scrollTop + parent.clientHeight),
      overLeft = element.offsetLeft - parent.offsetLeft < parent.scrollLeft,
      overRight = (element.offsetLeft - parent.offsetLeft + element.clientWidth - parentBorderLeftWidth) > (parent.scrollLeft + parent.clientWidth),
      alignWithTop = overTop && !overBottom;

  if (overTop || overBottom) {
    parent.scrollTop = element.offsetTop - parent.offsetTop - parent.clientHeight / 2 - parentBorderTopWidth + element.clientHeight / 2;
  }

  if (overLeft || overRight) {
    parent.scrollLeft = element.offsetLeft - parent.offsetLeft - parent.clientWidth / 2 - parentBorderLeftWidth + element.clientWidth / 2;
  }
}

export function schedule(cb, delay = 250) {
  var to = null;
  return function() {
    if (to)
      clearTimeout(to);
    to = setTimeout(function() {
      cb();
      to = null;
    }, delay);
  }
}

export function throttle(fn) {
  var running = null;
  return function() {
    if (running) { return; }
    running = function() {
      running = null;
      fn();
    };
    requestAnimationFrame(running);
  };
};
