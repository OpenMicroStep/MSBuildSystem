/// <reference path="../../typings/browser.d.ts" />

import View = require('../views/View');

type DragOptions = {
  type: string;
  mindist?: number;
  data?: any;
  ondragstart?:(data: any) => void;
  ondragend?:(type: string,data: any) => void;
};

type DropOptions = {
  type: string;
  ondragstart?:(data: any) => void;
  ondragend?:(type: string, data: any) => void;
  ondragover:(ev: MouseEvent, data: any) => string;
  ondragexit?:(ev: MouseEvent, data: any) => void;
  ondrag?:(ev: MouseEvent, data: any) => void;
  ondrop:(data: any, type: string) => void;
};
/*
function _start(event: MouseEvent, item: HTMLElement, options: DragOptions): void {
  if (event.button === 0) {
    var upfn, mvfn;
    var root = this.root();
    var dragnode: HTMLElement = null;
    var sx = event.screenX, sy = event.screenY;
    document.addEventListener("mousemove", mvfn = (event:MouseEvent) => {
      if (!dragnode) {
        var x = event.screenX, y = event.screenY;
        var dx = sx - x, dy = sy - y;
        if (dx * dx + dy * dy > options.mindist) {
          dragnode= document.createElement('div');
          document.body.appendChild(dragnode);
          dragnode.appendChild(item);
          if (options.ondragstart)
            options.ondragstart(options.data);
        }
      }
    }, true);
    document.addEventListener("mouseup", upfn = (event:MouseEvent) => {
      if (event.button === 0) {
        if (dragnode) {
          var el:any = document.elementFromPoint(event.clientX, event.clientY);
          var data = el._docklayout;
          if (data && data.root == root) {
            var view = this._tabs[idx].view;
            if (data.tab !== this || this._tabs.length > 1) {
              this.removeTab(idx);
              data.tab.appendViewTo(view, data.pos);
            }
          }
          root.hideDockPlaces();
        }
        document.removeEventListener("mousemove", mvfn, true);
        document.removeEventListener("mouseup", upfn, true);
      }
    }, true);
  }
}
*/
var dragging: { item: HTMLElement, options: DragOptions, over: HTMLElement } = null;
var ondragstart = [];
var ondragend = [];
var ondrag = [];

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
/*
document.addEventListener('drop', (ev) => {
  if (dragging && dragging.over) {
    dragging.over.dispatchEvent(new CustomEvent('_dragexit', { detail: ev }));
    dragging.over = null;
  }
}, true);*/

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
    ev.dataTransfer.setData("__custom", "");
    /* var dataTransfer:any = ev.dataTransfer;
    if (dataTransfer.setDragImage) {
      var blankImage = document.createElement("img");
      blankImage.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
      dataTransfer.setDragImage(blankImage, 0, 0);
    }*/
    dragging = { item: item, options: options, over: null };
    if (options.ondragstart) {
      setTimeout(() => {
        options.ondragstart(options.data);
        ondragstart.forEach((m) => { if (m.type === options.type) m.fn(options.data); });
      }, 0);
    }
  });
  item.addEventListener("dragend", (ev: DragEvent) => {
    if (dragging && dragging.over) {
      dragging.over.dispatchEvent(new CustomEvent('_dragexit', { detail: ev }));
      dragging.over = null;
    }
    dragging = null;
    if (options.ondragend)
      options.ondragend(ev.dataTransfer.dropEffect, options.data);
    ondragend.forEach((m) => { if (m.type === options.type) m.fn(ev.dataTransfer.dropEffect, options.data); });
  });
}

export function droppable(item: HTMLElement, options: DropOptions) {
  item.addEventListener('drop', (ev) => {
    if (dragging && dragging.over == item) {
      dragging.over.dispatchEvent(new CustomEvent('_dragexit', { detail: ev }));
      dragging.over = null;
      options.ondrop(dragging.options.data, ev.dataTransfer.dropEffect);
      ev.dataTransfer.dropEffect = "move";
      ev.preventDefault();
      ev.stopPropagation();
    }
  }, false);
  item.addEventListener('dragover', (ev) => {
    if (dragging && dragging.options.type === options.type) {
      if (dragging.over !== item && dragging.over)
        dragging.over.dispatchEvent(new CustomEvent('_dragexit', { detail: ev }));
      dragging.over = item;
      ev.dataTransfer.dropEffect = options.ondragover(ev, dragging.options.data);
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