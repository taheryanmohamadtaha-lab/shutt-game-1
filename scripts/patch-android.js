// تنظیمات اندروید: حالت افقی، تمام‌صفحه، آیکون بازی
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), app = path.join(root, 'android', 'app', 'src', 'main');
if (!fs.existsSync(app)) { console.error('android project not found'); process.exit(1); }

// 1) جهت صفحه
const mf = path.join(app, 'AndroidManifest.xml');
let x = fs.readFileSync(mf, 'utf8');
if (!x.includes('screenOrientation')) x = x.replace('<activity', '<activity\n            android:screenOrientation="sensorLandscape"');
fs.writeFileSync(mf, x);

// 2) تمام‌صفحه (immersive) و جلوگیری از خاموش شدن صفحه
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const act = walk(path.join(app, 'java')).find((f) => f.endsWith('MainActivity.java'));
if (act) {
  let j = fs.readFileSync(act, 'utf8');
  if (!j.includes('immersive')) {
    j = j.replace(/public class MainActivity extends BridgeActivity \{\s*\}/, `public class MainActivity extends BridgeActivity {
    // immersive
    private void goImmersive() {
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }
    @Override public void onResume() { super.onResume(); goImmersive(); }
    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) goImmersive(); }
}`);
    fs.writeFileSync(act, j);
  }
}

// 3) آیکون برنامه
const icon = path.join(root, 'assets', 'images', 'icon-512.png');
const res = path.join(app, 'res');
if (fs.existsSync(icon) && fs.existsSync(res)) {
  fs.rmSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true });
  for (const d of fs.readdirSync(res).filter((n) => n.startsWith('mipmap-'))) {
    for (const n of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) fs.copyFileSync(icon, path.join(res, d, n));
  }
}
console.log('android patched');
