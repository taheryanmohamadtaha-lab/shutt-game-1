// کپی فایل‌های نسخهٔ وب بازی به پوشهٔ www برای Capacitor
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'assets']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}
console.log('www ready:', fs.readdirSync(out).join(', '));
