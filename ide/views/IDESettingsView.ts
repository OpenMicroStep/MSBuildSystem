import core = require('../core');
import inputs = require('./inputs');
import settings = require('../views/settings');

var themelist = ace.require("ace/ext/themelist");

type Providers = {};
class ProviderInput extends inputs.Input<Providers> {
  constructor() {
    super();
    this.el.className = "form-control form-control-checkbox";
  }

  value() {
    return null;
  }
  setValue(val) {

  }
}

class IDESettingsView extends settings.SettingsView {
  static definition = new settings.SettingsDefinition(['settings'], [
    { label: "Theme", subs: [
      {
        label: 'Interface',
        type: inputs.SelectInput,
        default: "light",
        path: ['ide', 'theme'],
        options: [{label: "Light", value: "light"}, {label: "Dark", value: "dark"}]
      },
      {
        label: 'Editor',
        type: inputs.SelectInput,
        path: ['ace-editor', 'theme'],
        options: themelist.themes.map((theme) => {
          return { label: theme.caption, value: theme.theme }
        })
      },
    ]},
    { label: "Editor", subs: [
      { label: 'Scroll past end', type: inputs.CheckboxInput, default: true, path: ['ace-editor', 'scrollPastEnd'] },
      { label: 'Full line selection', type: inputs.CheckboxInput, default: "line", path: ['ace-editor', 'selectionStyle'],
        mapFromInput: (c) => { return c ? "line" : "text"; },
        mapToInput: (c) => { return c == "line"; }
      },
      { label: 'Highlight active line', type: inputs.CheckboxInput, default: true, path: ['ace-editor', 'highlightActiveLine'] },
      { label: 'Highlight selected word', type: inputs.CheckboxInput, default: true, path: ['ace-editor', 'highlightActiveLine'] },
      { label: 'Show invisibles', type: inputs.CheckboxInput, default: false, path: ['ace-editor', 'showInvisibles'] },
      { label: 'Show indent guides', type: inputs.CheckboxInput, default: false, path: ['ace-editor', 'displayIndentGuides'] },
      { label: 'Show line numbers', type: inputs.CheckboxInput, default: true, path: ['ace-editor', 'showLineNumbers'] },
      { label: 'Tab size', type: inputs.SelectInput, default: 4, path: ['ace-editor', 'tabSize'],
        options: [2,4,6,8].map((n) => { return { label: "" + n, value: n }}) },
      { label: 'Indent using spaces', type: inputs.CheckboxInput, default: true, path: ['ace-editor', 'useSoftTabs']},
      { label: 'Font size', type: inputs.SelectInput, default: 12, path: ['ace-editor', 'fontSize'],
        options: [10,11,12,13,14,16,18,20,24].map((n) => { return { label: n + "px", value: n }}) },
      { label: 'Soft wrap', type: inputs.SelectInput, default: "off", path: ['ace-editor', 'wrap'],
        options: [
          { label: "No wrap", value: "off"},
          { label: "Wrap at 40 chars", value: "40"},
          { label: "Wrap at 80 chars", value: "80"},
          { label: "Wrap"}]},
    ]},
    { label: "Providers", subs: [
      { type: inputs.CheckboxInput, default: {}, path: ['providers'] },
    ]},
  ])
  constructor() {
    super(IDESettingsView.definition);
    this.titleEl.textContent = "Settings";
  }

  destroy() {
    super.destroy();
  }
}

core.ContentView.register(IDESettingsView, "settings");

export = IDESettingsView;