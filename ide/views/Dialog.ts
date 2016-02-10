import View = require('./View');
/*
<div class="modal fade in" style="
    display: block;
    position: absolute;
"><div class="modal-backdrop fade in"></div><div class="modal-dialog">
    <!-- /.modal-content -->
  <div class="modal-content">
      <div class="modal-header">

        <h4 class="modal-title">File changed</h4>
      </div>
      <div class="modal-body">
        <p>One fine body…</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary">Save changes</button>
      </div>
    </div>

</div></div>
*/

class Dialog extends View {
  header: HTMLElement;
  body: HTMLElement;
  footer: HTMLElement;
  constructor(options: { title?: string, text?: string, primary?: string, secondary?: string }) {
    super();
    this.el.className = "modal fade";
    $('<div class="modal-backdrop fade in"></div>').appendTo(this.el);
    var $dialog = $('<div class="modal-dialog"></div>').appendTo(this.el);
    var $content = $('<div class="modal-content"></div>').appendTo($dialog);
    var $header = $('<div class="modal-header"></div>').appendTo($content);
    var $body = $('<div class="modal-body"></div>').appendTo($content);
    var $footer = $('<div class="modal-footer"></div>').appendTo($content);
    if (options.title)
      $('<h4 class="modal-title"></h4>').text(options.title).appendTo($header);
    if (options.text)
      $('<p></p>').text(options.text).appendTo($body);
    if (options.secondary)
      $('<button type="button" class="btn btn-secondary"></button>')
        .text(options.secondary)
        .click(this._emit.bind(this, "action", { action: "secondary"}))
        .appendTo($footer);
    if (options.primary)
      $('<button type="button" class="btn btn-primary"></button>')
        .click(this._emit.bind(this, "action", { action: "primary"}))
        .text(options.primary)
        .appendTo($footer);
  }

  modal(callback: (e: { action: string }) => void) {
    this.show();
    this.once('action', (e) => {
      this.willDestroy();
      callback(e);
    })
  }

  show() {
    this.$el.removeClass("out").addClass("in").show();
  }

  hide() {
    this.$el.removeClass("in").addClass("out");
  }

  willDestroy() {
    this.hide();
    setTimeout(() => {
      this.destroy();
    }, 1000);
  }
}

export = Dialog;