import * as child_process from 'child_process';
import * as path from 'path';

export function npm(action: 'install' | 'remove', modules: string[]) {
  child_process.execSync(`npm ${action} ${modules.join(' ')}`, {
    cwd: path.join(__dirname),
    stdio: ['inherit', 'inherit', 'inherit']
  });
}
