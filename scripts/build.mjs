/** Standard TypeScript compiler + deterministic DSH browser ModuleLoader bundle. Writes derived build/dist only. */
import ts from 'typescript';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const pkgVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const configPath = path.join(root, 'tsconfig.json');
const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
if (loaded.error) throw new Error(ts.flattenDiagnosticMessageText(loaded.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: x => x, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
  process.exit(1);
}
const emit = program.emit();
if (emit.emitSkipped) throw new Error('TypeScript emission was skipped.');
const buildTypes = path.join(root, 'build/src/types.js');
writeFileSync(buildTypes, readFileSync(buildTypes, 'utf8').replaceAll('__PLUGIN_VERSION__', pkgVersion), 'utf8');

// Publish only the host entry's runtime dependency graph. Developer declarations,
// source maps and the unbundled React modules remain in ignored build/.
const hostModules = new Map();
function includeHost(id) {
  if (hostModules.has(id)) return;
  if (id.startsWith('../') || path.posix.isAbsolute(id)) throw new Error('Host module escapes src: ' + id);
  const code = readFileSync(path.join(root, 'build/src', id), 'utf8')
    .replace(/\r?\n\/\/# sourceMappingURL=[^\r\n]*(?:\r?\n)?$/, '\n');
  hostModules.set(id, code);
  const source = ts.createSourceFile(id, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  function visit(node) {
    const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
    if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
      includeHost(path.posix.normalize(path.posix.join(path.posix.dirname(id), specifier.text)));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
includeHost('index.js');
const distDirectory = path.join(root, 'dist');
rmSync(distDirectory, { recursive: true, force: true });
for (const [id, code] of hostModules) {
  const destination = path.join(distDirectory, id);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, code, 'utf8');
}

const modules = [];
for (const source of program.getSourceFiles()) {
  if (source.isDeclarationFile) continue;
  const relative = path.relative(path.join(root, 'src'), source.fileName).split(path.sep).join('/');
  if (!(relative.startsWith('client/') || relative === 'types.ts')) continue;
  const id = '/' + relative.replace(/\.tsx?$/, '.js');
  const compiled = ts.transpileModule(source.text, { fileName: source.fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText.replaceAll('__PLUGIN_VERSION__', pkgVersion);
  modules.push([id, compiled]);
}
modules.sort((a, b) => a[0].localeCompare(b[0], 'en'));
const definitions = modules.map(([id, code]) => JSON.stringify(id) + ': function(require,module,exports) {\n' + code + '\n}').join(',\n');
const bundle = '/* Generated from TypeScript. React is provided by the DSH browser host. */\nwindow.__ModuleLoader__.load({ id: "dsh-mimic", factory: function(external) {\n' +
'const factories={' + definitions + '}; const cache={};\n' +
'function load(id) { if(cache[id])return cache[id].exports; if(!factories[id])return external(id); const module={exports:{}}; cache[id]=module; const local=(name)=>{ if(!name.startsWith("."))return external(name); const parts=id.split("/");parts.pop(); for(const p of name.split("/")){if(p==="..")parts.pop();else if(p!==".")parts.push(p);} return load(parts.join("/")); }; factories[id](local,module,module.exports); return module.exports;}\n' +
'const entry=load("/client/index.js");return entry.default || entry;\n}});\n';
writeFileSync(path.join(distDirectory, 'client.js'), bundle, 'utf8');
console.log('Built ' + hostModules.size + ' host ESM modules and browser ModuleLoader bundle (' + modules.length + ' local modules).');
