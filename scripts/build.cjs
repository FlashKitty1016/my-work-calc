// Create a portable HTML file without a bundler or third-party dependencies.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.resolve(root, process.argv[2] || 'dist/my-work-calc.html');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/  <link rel="stylesheet" href="(assets\/[^"]+)">/g, (_, file) => `  <style>\n${fs.readFileSync(path.join(root, file), 'utf8')}</style>`);
const scriptPattern = /  <script src="(assets\/[^"]+)" defer><\/script>/g;
const scripts = [...html.matchAll(scriptPattern)].map((match) => fs.readFileSync(path.join(root, match[1]), 'utf8'));
html = html.replace(scriptPattern, '');
// Inline scripts run after the form exists, in the same order as the source page.
html = html.replace('</body>', () => `  <script>\n${scripts.join('\n')}  </script>\n</body>`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log(`Built ${output}`);
