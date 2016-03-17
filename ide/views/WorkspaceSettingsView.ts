import core = require('../core');
import Workspace = require('../client/Workspace');
import settings = require('./settings');
import inputs = require('./inputs');
type Graph = Workspace.Graph;

class WorkspaceSettingsView extends settings.SettingsView {

  constructor() {
    var workspace = core.globals.ide.session.workspace;
    var envs = workspace.environments.filter(n => !n.splitInto).map(n => n.name);
    var targets = workspace.targets.map(n => n.name);
    super(new settings.SettingsDefinition(['buildgraph'], [
      {
        label: 'Variants',
        type: inputs.ChecklistInput,
        default: ["debug"],
        path: ['variants'],
        options: ["debug", "release"]
      },
      {
        label: 'Environments',
        type: inputs.ChecklistInput,
        default: envs,
        path: ['environments'],
        options: envs
      },
      {
        label: 'Targets',
        type: inputs.ChecklistInput,
        default: targets,
        path: ['targets'],
        options: targets
      }
    ]));
    this.titleEl.textContent = "Workspace settings";
  }
}
core.ContentView.register(WorkspaceSettingsView, "workspace-settings");

export = WorkspaceSettingsView;
