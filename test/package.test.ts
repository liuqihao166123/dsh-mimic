import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = basename(dirname(testDirectory)) === 'build'
  ? resolve(testDirectory, '../..') : resolve(testDirectory, '..');
const distDirectory = resolve(projectDirectory, 'dist');
const manifest = JSON.parse(readFileSync(resolve(projectDirectory, 'package.json'), 'utf8')) as {
  main: string; dependencies: Record<string, string>;
};

function distributionFiles(directory = distDirectory): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? distributionFiles(file) : [relative(distDirectory, file).split(sep).join('/')];
  });
}

test('the shipping host entry loads with its real package dependencies', async () => {
  const plugin = await import(pathToFileURL(resolve(projectDirectory, manifest.main)).href) as {
    name: unknown; inject: unknown; apply: unknown; Config: unknown;
  };
  assert.equal(plugin.name, 'dsh-mimic');
  assert.deepEqual(plugin.inject, ['settings', 'llm', 'webServer']);
  assert.equal(typeof plugin.apply, 'function');
  assert.ok(plugin.Config);
});

test('dist contains the complete host import graph and one browser bundle, without redundant artifacts', () => {
  const files = distributionFiles();
  const hostFiles = new Set<string>();
  function inspect(file: string) {
    const absolute = resolve(distDirectory, file);
    assert.ok(absolute.startsWith(distDirectory + sep), 'relative imports stay in dist');
    file = relative(distDirectory, absolute).split(sep).join('/');
    if (hostFiles.has(file)) return;
    const code = readFileSync(absolute, 'utf8');
    hostFiles.add(file);
    assert.doesNotMatch(code, /\/\/# sourceMappingURL=/, 'shipping JS has no dangling source-map reference');
    const source = ts.createSourceFile(file, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
    function visit(node: ts.Node) {
      const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
      if (specifier && ts.isStringLiteral(specifier)) {
        if (specifier.text.startsWith('.')) inspect(relative(distDirectory, resolve(dirname(absolute), specifier.text)));
        else assert.ok(specifier.text.startsWith('node:') || specifier.text in manifest.dependencies, 'external dependency is declared: ' + specifier.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  inspect(relative(distDirectory, resolve(projectDirectory, manifest.main)));
  assert.deepEqual(files.sort(), [...hostFiles, 'client.js'].sort(), 'orphan JS, declarations, maps and duplicate client modules are excluded');
  assert.ok(readFileSync(resolve(distDirectory, 'client.js'), 'utf8').includes('window.__ModuleLoader__.load('));
});
