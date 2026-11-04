import { build, transform } from 'esbuild';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import less from 'less';
import path from 'node:path';

await mkdir('script/dist', { recursive: true });
const styles = await less.render((await readFile('i/css/dev/funcs.css','utf8')) + '\n' + (await readFile('i/css/main_tpl.css','utf8')),
  {filename: path.resolve('i/css/main_tpl.css'), javascriptEnabled: false});
await writeFile('script/dist/main.css',styles.css);
await build({ entryPoints: ['frontend/index.ts'], bundle: true, format: 'iife', globalName: 'GraphOnline',
  outfile: 'script/dist/core.js', sourcemap: true, target: 'es2022' });
await build({ entryPoints: ['frontend/algorithm-worker.ts'], bundle: true, format: 'iife',
  outfile: 'script/dist/algorithm-worker.js', sourcemap: true, target: 'es2022' });
await build({ entryPoints: ['frontend/layout-worker.ts'], bundle: true, format: 'iife',
  outfile: 'script/dist/layout-worker.js', sourcemap: true, target: 'es2022' });

// Preserve the existing module API while producing its caches from source in CI.
const entries = ['editor', 'create_graph_by_matrix', 'create_graph_by_incidence_matrix', 'create_graph_by_edge_list'];
for (const page of entries) {
  const seen = new Set();
  const chunks = [];
  async function visit(filename) {
    if (seen.has(filename)) return;
    seen.add(filename);
    const source = await readFile(path.join('script', filename), 'utf8');
    const directory = /let modulDir\s*=\s*"([^"]+)"/.exec(source)?.[1] || '';
    const includeBlock = /doInclude\s*\(\s*\[([\s\S]*?)\]/.exec(source)?.[1] || '';
    for (const match of includeBlock.matchAll(/include\s*\(\s*"([^"]+)"\s*(,\s*modulDir)?\s*\)/g)) {
      await visit((match[2] ? directory : '') + match[1]);
    }
    chunks.push(source);
  }
  const entry = `pages/${page}/api/index.js`;
  await visit(entry);
  const urls = [...seen].map(file => `"/script/${file}?v=" + globalVersion`);
  const output = `moduleLoader.beginCacheLoading([${urls.join(',')}]);\n${chunks.join('\n;\n')}\nmoduleLoader.endCacheLoading();\n`;
  const packed = await transform(output, { minifyWhitespace: true, target: "es2022" });
  await writeFile(`script/${entry}.cache`, packed.code);
}

const scripts = (await readdir('script', {recursive: true})).filter(file => /\.(?:js|js\.cache|wasm)$/.test(file));
const css = ['i/css/dev/bootstrap5/bootstrap.css','i/css/dev/bootstrap-icons/bootstrap-icons.css',
  'script/dist/main.css','i/css/home.css','i/css/jquery-ui.css','i/css/jquery-ui.theme.css','i/css/jquery.feedback_me.css','i/css/css_pt_sans.css'];
const libraries = ['i/js/dev/jquery-2.0.3.min.js','i/js/dev/jquery-ui.min.js','i/js/dev/bootstrap5/bootstrap.bundle.min.js'];
const images = (await readdir('i/css/images')).filter(file=>/\.(?:png|gif)$/.test(file)).map(file=>`i/css/images/${file}`);
const fonts = [];
for (const directory of ['i/css/dev/bootstrap-icons/font/fonts','i/css/dev/bootstrap-icons/fonts','fonts']) {
  try { for (const file of await readdir(directory)) if (/\.woff2?$/.test(file)) fonts.push(`${directory}/${file}`); } catch {}
}
const assets = [...new Set([...scripts.map(file => `script/${file}`),...css,...libraries,...images,...fonts,'favicon.ico','manifest.webmanifest'])];
const hash = createHash('sha256');
for (const file of assets.sort()) hash.update(await readFile(file));
const version = hash.digest('hex').slice(0,16);
await writeFile('script/dist/version.txt', version);
const shells = ['/','/en/','/fr/','/de/','/el/','/es/','/nl/','/sv/','/pt/','/bg/','/ch/','/pl/','/cs/','/ua/'];
const serviceWorker = (await readFile('tools/service-worker.js','utf8')).replace('__VERSION__',version).replace('__ASSETS__',JSON.stringify([...assets.map(file=>'/'+file),...shells]));
await writeFile('service-worker.js',serviceWorker);
