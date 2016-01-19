import core = require('../core');
import TTY = require('../client/Terminal');
import term = require('term');
var Terminal:any = term;

class TerminalView extends core.ContentView {
  term;
  constructor(public tty: TTY) {
    super();
    this.el.className = "fill terminalview";
    this.titleEl.textContent = "Run";
    this.term = new Terminal({
      cols: 100,
      rows: 100,
      cursorBlink: false
    });
    this.term.open(this.el);
    this.term.on('data', (data) => {
      core.async.run(null, (p) => { if (this.tty) this.tty.write(p, data); });
    });
    this.term.on('title', (title) => {
      this.titleEl.textContent = title;
    });
    this.tty.on('data', (e) => {
      this.term.write(e.chunk);
    });
    this.tty.once('exit', (e) => {
      if (this.tty)
        this.tty.destroy();
      this.tty = null;
    });
  }

  destroy() {
    this.term.destroy();
    if (this.tty)
      this.tty.destroy();
    this.tty = null;
    super.destroy();
  }

  resize() {
    var dh = $(this.el).innerHeight();
    var dw = $(this.el).innerWidth();
    var th = $(this.term.element).innerHeight();
    var tw = $(this.term.element).innerWidth();
    var r = this.term.rows;
    var c = this.term.cols;
    var ch = th/r;
    var cw = tw/c;
    var br = Math.floor(dh/ch);
    var bc = Math.floor(dw/cw);
    if (br != r || bc != c) {
      this.term.resize(bc, br);
      core.async.run(null, (p) => { if (this.tty) this.tty.resize(p, bc, br); });
    }
    super.resize();
  }
}

export = TerminalView;
