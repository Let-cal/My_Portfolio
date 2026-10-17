import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { unicodePoints } from '../../scripts/font-ranges.mjs';

const manifestPath = 'src/app/fonts/site-subsets.json';
const hash = data => createHash('sha256').update(data).digest('hex');

test('bounded Latin assets have exact ranges, hashes and priority without replacing originals', () => {
  assert.ok(existsSync(manifestPath), 'generated site subset manifest must exist');
  const rows = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const requested = new Set([...Array.from({ length: 95 }, (_, i) => i + 32), 0xa0,
    ...Array.from({ length: 112 }, (_, i) => i + 0x2000)]);
  for (const path of readdirSync('src', { recursive: true }).sort()) {
    const file = `src/${path.replaceAll('\\', '/')}`;
    if (/\.(ts|tsx|json)$/.test(file) && file !== manifestPath) {
      for (const char of readFileSync(file, 'utf8')) requested.add(char.codePointAt(0));
    }
  }
  for (const point of [...requested]) {
    const char = String.fromCodePoint(point);
    for (const form of [char.toUpperCase(), char.toLowerCase()]) {
      for (const transformed of form) requested.add(transformed.codePointAt(0));
    }
  }
  // Independently derive canonical intermediates, including non-prefix mark subsets.
  for (const point of [...requested]) {
    const parts = [...String.fromCodePoint(point).normalize('NFD')];
    const addForms = text => {
      for (const form of [text.normalize('NFC'), text.normalize('NFD')]) {
        for (const char of form) requested.add(char.codePointAt(0));
      }
    };
    addForms(parts.join(''));
    if (parts.slice(1).every(char => /\p{Mark}/u.test(char))) {
      for (let mask = 0; mask < 2 ** (parts.length - 1); mask++) {
        addForms(parts[0] + parts.slice(1).filter((_, i) => mask & (1 << i)).join(''));
      }
    }
  }
  const originals = JSON.parse(readFileSync('src/app/fonts/manifest.json', 'utf8'));
  const css = readFileSync('src/app/fonts/vietnamese.css', 'utf8');
  const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(m => m[1]);
  assert.deepEqual(rows.map(row => row.family), ['Inter', 'Space Grotesk']);
  for (const original of originals) {
    const data = readFileSync(`public/fonts/${original.file}`);
    assert.equal(hash(data), original.sha256, original.file);
    assert.equal(data.length, original.bytes);
    const face = faces.find(face => face.includes(`/fonts/${original.file})`));
    assert.ok(face);
    assert.ok(face.includes(`unicode-range:${original.effectiveUnicodeRange ?? original.unicodeRange}`));
  }
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ['family', 'file', 'sourceFile', 'sha256', 'bytes', 'unicodeRange', 'codepoints', 'weights'].sort());
    const data = readFileSync(`public/fonts/${row.file}`);
    const source = originals.find(original => original.file === row.sourceFile);
    assert.equal(source.family, row.family);
    assert.equal(hash(data), row.sha256);
    assert.equal(data.length, row.bytes);
    assert.ok(row.bytes < source.bytes);
    assert.ok(row.file.includes(row.sha256.slice(0, 8)));
    assert.deepEqual(row.codepoints, [...new Set(row.codepoints)].sort((a, b) => a - b));
    assert.deepEqual([...unicodePoints(row.unicodeRange)].sort((a, b) => a - b), row.codepoints);
    for (let point = 32; point <= 126; point++) assert.ok(row.codepoints.includes(point));
    assert.ok(row.codepoints.includes(0xa0), 'NBSP must cover runtime spacing');
    for (const point of [0xC0, 0xC2, 0xC8, 0xCA, 0xCC, 0xD2, 0xD4, 0xD9]) {
      assert.ok(row.codepoints.includes(point), `${row.family}: CSS uppercase Vietnamese Latin U+${point.toString(16)} must be covered`);
    }
    assert.ok(row.codepoints.every(point => requested.has(point)), 'no unrelated cmap points');
    assert.deepEqual(row.weights, row.family === 'Inter' ? [100, 900] : [300, 700]);
    const own = faces.filter(face => face.includes(`font-family:${row.family};`));
    assert.ok(own.at(-3).includes(`/fonts/${row.sourceFile})`));
    assert.ok(own.at(-2).includes(`/fonts/${row.file})`));
    assert.ok(own.at(-2).includes(`unicode-range:${row.unicodeRange}`));
    assert.ok(own.at(-2).includes('font-display:optional'));
    assert.ok(own.at(-1).includes('1ea0-1ef9'));
  }
});

test('assets contain only standard all-feature shaping closure, without inactive feature support', () => {
  const result = spawnSync('uv', ['run', '--with', 'fonttools==4.67.0', '--with', 'brotli==1.2.0', 'python', '-c', `
import json
from fontTools import subset
from fontTools.ttLib import TTFont
for row in json.load(open('src/app/fonts/site-subsets.json')):
    source = TTFont('public/fonts/' + row['sourceFile'], recalcTimestamp=False)
    actual = TTFont('public/fonts/' + row['file'], recalcTimestamp=False)
    options = subset.Options()
    options.layout_features = ['*']
    options.layout_scripts = ['*']
    options.glyph_names = True
    options.notdef_outline = True
    tool = subset.Subsetter(options=options)
    tool.populate(unicodes=row['codepoints'])
    tool.subset(source)
    assert actual.getGlyphOrder() == source.getGlyphOrder(), row['family'] + ': unnecessary glyphs beyond standard shaping closure'
    for tag in ('GSUB', 'GPOS'):
        def tags(font):
            return {r.FeatureTag for r in font[tag].table.FeatureList.FeatureRecord} if tag in font and font[tag].table.FeatureList else set()
        assert tags(actual) == tags(source), row['family'] + ': applicable feature tags differ'
print('Standard shaping closure verified for both assets')
`], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('canonical closure includes non-prefix compositions and LF/CRLF preserve the cmap repertoire', () => {
  const result = spawnSync('uv', ['run', '--with', 'fonttools==4.67.0', '--with', 'brotli==1.2.0', 'python', '-c', `
import json
from pathlib import Path
import runpy
from tempfile import TemporaryDirectory
from fontTools.ttLib import TTFont

module = runpy.run_path('scripts/generate-site-fonts.py')
closure = module['canonical_closure']
# U+1EAC decomposes as A + dot below + circumflex: selecting only the
# circumflex must retain U+00C2, which a prefix-only algorithm misses.
assert closure({0x1EAC}) == {0x1EAC, 0x41, 0x323, 0x302, 0x1EA0, 0xC2}
assert closure({0x1EAD}) == {0x1EAD, 0x61, 0x323, 0x302, 0x1EA1, 0xE2}
assert closure(closure({0x1EAC, 0x1EAD})) == closure({0x1EAC, 0x1EAD}), 'closure must be idempotent'
repertoire = module['repertoire']
rows = json.loads(Path('src/app/fonts/site-subsets.json').read_text(encoding='utf-8'))
files = [(p.relative_to('src'), p.read_text(encoding='utf-8'))
         for p in sorted(Path('src').rglob('*'))
         if p.suffix in ('.ts', '.tsx', '.json') and p != Path('src/app/fonts/site-subsets.json')]
with TemporaryDirectory(prefix='site-font-line-endings-') as directory:
    root = Path(directory)
    repertoire.__globals__['ROOT'] = root
    repertoire.__globals__['MANIFEST'] = root / 'src/app/fonts/site-subsets.json'
    sets = []
    for ending in (b'\\n', b'\\r\\n'):
        for relative, text in files:
            target = root / 'src' / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(text.encode('utf-8').replace(b'\\n', ending))
        sets.append(repertoire())
    assert sets[0] == sets[1], 'line endings changed source repertoire'
    for row in rows:
        cmap = set(TTFont('public/fonts/' + row['sourceFile']).getBestCmap())
        points = sets[0] & cmap
        assert sorted(points) == row['codepoints'], row['family'] + ': cmap repertoire changed'
        assert not points.intersection(range(32)), 'line-ending/control codepoints advertised'
print('LF/CRLF repertoire matches both manifests; controls excluded by source cmap')
`], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
});

test('read-only regeneration verifies exact cmap, outlines, metrics, variation and layout retention', () => {
  assert.ok(existsSync(manifestPath), 'generated site subset manifest must exist');
  const files = [manifestPath, 'src/app/fonts/manifest.json', 'src/app/fonts/vietnamese.css',
    ...readdirSync('public/fonts').map(file => `public/fonts/${file}`)];
  const snapshot = () => files.map(file => [file, hash(readFileSync(file)), statSync(file).mtimeMs]);
  const before = snapshot();
  const result = spawnSync('uv', ['run', 'scripts/generate-site-fonts.py', '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Verified 2 site subsets/);
  assert.deepEqual(snapshot(), before, '--check must not rewrite even identical files');
});
