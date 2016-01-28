import View = require('../views/View');
import {pathBasename} from './util';

type DragOptions = {
  type: string;
  mindist?: number;
  data?: any;
  dnd?: () => { text?: string, data?: any, file?: string };
  ondragstart?:(data: any) => void;
  ondragend?:(type: string,data: any) => void;
  external?: boolean;
};

type DropOptions = {
  type: string;
  ondragstart?:(data: any) => void;
  ondragend?:(type: string, data: any) => void;
  ondragover:(ev: MouseEvent, data: any) => string;
  ondragexit?:(ev: MouseEvent, data: any) => void;
  ondrag?:(ev: MouseEvent, data: any) => void;
  ondrop:(ev: { data?:any, dropEffect: string, externaldata?: any }) => void;
};

var dragging: { options: DragOptions, over: HTMLElement, dropEffect: string } = null;
var ondragstart = [];
var ondragend = [];
var ondrag = [];
var dragexternaltimeout = null;
var prefix = "custom/";

function dragstart(options) {
  if (ondragstart.length > 0 || options.ondragstart) {
    setTimeout(() => {
      if (options.ondragstart)
        options.ondragstart(options.data);
      ondragstart.forEach((m) => { if (m.type === options.type) m.fn(options.data); });
    }, 0);
  }
}

function dragend(options, ev, dropEffect, data) {
  if (dragexternaltimeout) {
    clearTimeout(dragexternaltimeout);
    dragexternaltimeout = null;
  }
  if (dragging && dragging.over) {
    dragging.over.dispatchEvent(new CustomEvent('_dragexit', { detail: ev }));
    dragging.over = null;
  }
  dragging = null;
  if (options.ondragend)
    options.ondragend(ev.dataTransfer.dropEffect, options.data);
  ondragend.forEach((m) => { if (m.type === options.type) m.fn(dropEffect, data); });
}

function externaldata(ev: DragEvent) {
  try {
    return JSON.parse(ev.dataTransfer.getData("__customdata"));
  } catch(e) {
    return null;
  }
}

function externaltimeoutcheck(ev) {
  if (dragging && dragging.options.external) {
    if (dragexternaltimeout) {
      clearTimeout(dragexternaltimeout);
    }
    dragexternaltimeout = setTimeout(function() {
      dragend(dragging.options, ev, "none", null);
    }, 250);
  }
}

document.addEventListener('dragover', (ev) => {
  externaltimeoutcheck(ev);
  if (!dragging) {
    var types = ev.dataTransfer.types;
    for (var i = 0, len = types.length; i < len; ++i) {
      var type = types[i];
      if (type.startsWith(prefix)) {
        var options = { type: type.substring(prefix.length), external: true };
        dragging = { options: options, over: null, dropEffect: "none" };
        externaltimeoutcheck(ev);
        dragstart(options);
        i = len;
      }
    }
  }
}, true);
document.addEventListener('dragover', (ev) => {
  if (dragging && dragging.over) {
    var rect = dragging.over.getBoundingClientRect();
    var x = ev.clientX, y = ev.clientY;
    if (x > rect.right || x < rect.left || y > rect.bottom || y < rect.top) {
      dragging.over.dispatchEvent(new CustomEvent('_dragexit', { detail: ev }));
      dragging.over= null;
    }
    ondrag.forEach((m) => { if (m.type === dragging.options.type) m.fn(ev, dragging.options.data); });
  }
}, false);


export var DropAction = {
  Copy: "copy",
  Move: "move",
  None: "none"
}

export function draggable(item: HTMLElement, options: DragOptions) {
  options.mindist = typeof options.mindist === "number" ? options.mindist : 10;
  item.draggable = true;item.addEventListener("dragstart", (ev: DragEvent) => {
    ev.dataTransfer.effectAllowed = "moveCopy";
    ev.dataTransfer.dropEffect = "none";
    var dnd: any = options.dnd ? options.dnd() : {};
    var data = dnd.data;
    var file = dnd.file;
    var text = dnd.text;
    ev.dataTransfer.setData(prefix + options.type, "");
    if (data)
      ev.dataTransfer.setData("__customdata", JSON.stringify(data));
    if (text || file)
      ev.dataTransfer.setData("text/plain", text || file);
    if (file) {
      var uri = "application/octet-stream:" + pathBasename(file) + ":" + location.origin +"/file/" + encodeURIComponent(file);
      console.log(uri);
      ev.dataTransfer.setData("DownloadURL",uri);
    }
    dragging = { options: options, over: null, dropEffect: "none" };
    dragstart(options);
  });
  item.addEventListener("dragend", (ev: DragEvent) => {
    dragend(options, ev, ev.dataTransfer.dropEffect, options.data);
  });
}

export function droppable(item: HTMLElement, options: DropOptions) {
  item.addEventListener('drop', (ev) => {
    if (dragging && dragging.over == item) {
      dragging.over.dispatchEvent(new CustomEvent('_dragexit', { detail: ev }));
      dragging.over = null;

      options.ondrop({ data: dragging.options.data, dropEffect: dragging.dropEffect, externaldata: externaldata(ev) });
      ev.dataTransfer.dropEffect = dragging.dropEffect;
      ev.preventDefault();
      ev.stopPropagation();
      if (dragging.options.external)
        dragend(dragging.options, ev, dragging.dropEffect, null);
    }
  }, true);
  item.addEventListener('dragover', (ev) => {
    if (dragging && dragging.options.type === options.type) {
      if (dragging.over !== item && dragging.over)
        dragging.over.dispatchEvent(new CustomEvent('_dragexit', { detail: ev }));
      dragging.over = item;
      ev.dataTransfer.dropEffect = dragging.dropEffect = options.ondragover(ev, dragging.options.data);
      ev.preventDefault();
      ev.stopPropagation();
    }
  }, false);
  if (options.ondragexit) {
    item.addEventListener('_dragexit',  (ev: CustomEvent) => {
      if (dragging && dragging.options.type === options.type && ev.target == item) {
        options.ondragexit(ev.detail, dragging.options.data);
      }
    }, false);
  }
  if (options.ondragstart)
    ondragstart.push({type: options.type, fn: options.ondragstart });
  if (options.ondragend)
    ondragend.push({type: options.type, fn: options.ondragend });
  if (options.ondrag)
    ondrag.push({type: options.type, fn: options.ondrag });
}