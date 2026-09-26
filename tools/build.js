// Bundles index.html and every js/*.js script into one self-contained HTML
// file, which is built into the Windows executable. Called by tools/build-exe.sh.
//   node tools/build.js   -> desktop/game.html
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>\n// ---- ' + src + '\n' + code + '\n</script>';
});

const out = path.join(root, 'desktop', 'game.html');
fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(root, out) + ' (' + Math.round(html.length / 1024) + ' KB)');
