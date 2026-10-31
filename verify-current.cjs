const fs = require('node:fs'); const path = require('node:path'); const { spawn } = require('node:child_process');
const root = name => path.dirname(require.resolve(name + '/package.json'));
const stages = [
 ['typecheck', [path.join(root('typescript'), 'bin/tsc'), '--noEmit']],
 ['lint', [path.join(root('eslint'), 'bin/eslint.js'), 'src', '--no-cache', '--max-warnings=0']],
 ['unit', [path.join(root('vitest'), 'vitest.mjs'), 'run', '--testTimeout=20000']],
 ['mocked-web', ['run-mocked-ui.cjs']],
];
(async () => {
 fs.mkdirSync('test-results', { recursive: true });
 const result = { started: new Date().toISOString(), status: 'running', stages: [] };
 const save = () => fs.writeFileSync('test-results/verification-latest.json', JSON.stringify(result, null, 2)); save();
 for (const [name, args] of stages) {
  const item = { name, started: new Date().toISOString(), status: 'running' }; result.stages.push(item); save();
  const log = fs.createWriteStream('test-results/' + name + '-latest.log');
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.on('data', data => { log.write(data); process.stdout.write(data) }); child.stderr.on('data', data => { log.write(data); process.stderr.write(data) });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', (code, signal) => resolve(signal ? 1 : code ?? 1)) });
  await new Promise(resolve => log.end(resolve)); item.exitCode = code; item.status = code === 0 ? 'passed' : 'failed'; item.finished = new Date().toISOString(); save();
  if (code !== 0) { result.status = 'failed'; save(); process.exitCode = code; return }
 }
 result.status = 'passed'; result.finished = new Date().toISOString(); save();
})().catch(error => { console.error(error); process.exitCode = 1 });
