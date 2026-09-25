// Bundles index.html and every js/*.js script into one self-contained HTML file.
//   node tools/build.js          -> dist/the-endless-march.html        (release)
//   node tools/build.js --test   -> dist/the-endless-march-test.html   (debug keys on)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const test = process.argv.includes('--test');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>\n// ---- ' + src + '\n' + code + '\n</script>';
});
if (test) {
  html = html.replace('</title>', ' (test build)</title>');
  html = html.replace('<body>', '<body>\n<script>window.SEEK_TEST_BUILD = true;</script>');
}

const out = path.join(root, 'dist', test ? 'the-endless-march-test.html' : 'the-endless-march.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(root, out) + ' (' + Math.round(html.length / 1024) + ' KB)');
