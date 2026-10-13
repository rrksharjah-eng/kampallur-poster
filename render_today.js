// Usage: node render_today.js [DD-MM-YYYY]  -> writes out/Poster_<date>_UltraHD.png (1440x2560)
const path = require('path'), fs = require('fs');
const T = __dirname;
const { createCanvas, registerFont, Image: CImg } = require(T + '/tools/node_modules/canvas');
const Papa = require(T + '/tools/node_modules/papaparse');
for (const w of [600, 700, 800, 900]) registerFont(`${T}/fonts/Anek${Math.min(w, 800)}.ttf`, { family: 'Anek Malayalam', weight: String(w) });

(async () => {
  const html = fs.readFileSync(T + '/index_orig_icons.html', 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  let js = scripts[scripts.length - 1][1];
  const CSV_URL = js.match(/const CSV_URL = "([^"]+)"/)[1];
  const IDOL = js.match(/const IDOL_SAFE_URL = "([^"]+)"/)[1];
  js = js.slice(0, js.indexOf('Papa.parse('));

  // today's date in Asia/Dubai
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
  const arg = process.argv[2];
  let d = now;
  if (arg) { const [dd, mm, yy] = arg.split('-').map(Number); d = new Date(yy, mm - 1, dd); }
  const todayStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

  const csv = await (await fetch(CSV_URL)).text();
  const rows = Papa.parse(csv, { header: true }).data;
  const row = rows.find(r => r['തീയതി'] && r['തീയതി'].trim() === todayStr);
  if (!row) { console.error('NO_ROW_FOR ' + todayStr); process.exit(2); }
  const months = ["ജനുവരി", "ഫെബ്രുവരി", "മാർച്ച്", "ഏപ്രിൽ", "മേയ്", "ജൂൺ", "ജൂലൈ", "ഓഗസ്റ്റ്", "സെപ്റ്റംബർ", "ഒക്ടോബർ", "നവംബർ", "ഡിസംബർ"];
  const mantraKey = Object.keys(row).find(k => k.trim() === 'മന്ത്രം');
  const data = {
    mainDate: `${months[d.getMonth()]} ${d.getDate()} ${row['ദിവസം']}`,
    malMonth: `1202 ${row['മാസം']}`,
    engDate: row['തീയതി'],
    sunrise: row['സൂര്യോദയം'], sunset: row['സൂര്യാസ്തമയം'],
    moonrise: row['ചന്ദ്രോദയം'], moonset: row['ചന്ദ്രാസ്തമയം'],
    tithi: row['തിഥി'], star: row['നക്ഷത്രം'],
    rahukalam: row['രാഹുകാലം'], gulikakalam: row['ഗുളികകാലം'],
    mantra: (mantraKey && row[mantraKey]) || "ഭക്തിപ്രിയേ ഭേതിഗമ്യേ കമ്പല്ലൂർപുരസ്ഥിതേ\nഭക്തിം യച്ഛതു മേ മാതാ ഭഗവത്യൈ നമോസ്തു തേ"
  };

  for (const k in data) if (typeof data[k] === 'string') data[k] = data[k].trim();
  const idolBuf = Buffer.from(await (await fetch(IDOL)).arrayBuffer());
  const canvas = createCanvas(1440, 2560);
  const ctx = canvas.getContext('2d');
  if (!ctx.roundRect) ctx.roundRect = function (x, y, w, h, r) { this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
  const od = ctx.drawImage.bind(ctx); ctx.drawImage = (im, ...a) => od(im._i || im, ...a);
  global.document = { getElementById: id => id === 'posterCanvas' ? canvas : { set innerText(v) {} }, createElement: () => ({ click() {} }) };
  // auto-fit long mantra lines inside the green box (shrinks only that line's font; design otherwise unchanged)
  global._fitText = (ctx, t, x, y, maxW = 1160) => { const f = ctx.font; let sz = parseInt(f.match(/(\d+)px/)[1]); while (ctx.measureText(t).width > maxW && sz > 28) { sz -= 1; ctx.font = f.replace(/\d+px/, sz + 'px'); } ctx.fillText(t, x, y); ctx.font = f; };
  js = js.replace(/ctx\.fillText\((mantraLines\[[01]\]|data\.mantra), 720, (mY \+ \d+)\)/g, '_fitText(ctx, $1, 720, $2)');
  global._noop = () => {}; js = js.replace(/setTimeout\(/g, '_noop(');
  let drawn;
  const done = new Promise(r => drawn = r);
  global.Image = class { set src(v) { const i = new CImg(); i.onload = () => setImmediate(() => { this.width = i.width; this.height = i.height; this._i = i; this.onload && this.onload(); drawn(); }); i.src = idolBuf; } };
  eval(js + ';drawPoster(data);');
  await done;
  // special-day ribbon (specials.json: {"DD-MM-YYYY": "text"}); drawn over the photo's lower edge
  let specials = {}; try { specials = JSON.parse(fs.readFileSync(T + '/specials.json', 'utf8')); } catch (e) {}
  const sp = (specials.ribbon || specials)[todayStr];
  const pg = (specials.program || {})[todayStr];
  const ft = (specials.footer || {})[todayStr];
  const dt = (specials.detail || {})[todayStr] || (pg ? [pg] : null);
  if (sp) {
    const W = 1440, cx = W / 2, two = !!ft, h = two ? 168 : 118, y = two ? 712 : 760;
    ctx.save();
    ctx.font = '800 56px "Anek Malayalam"'; let tw = ctx.measureText(sp).width;
    if (two) { ctx.font = '700 42px "Anek Malayalam"'; tw = Math.max(tw, ctx.measureText('\u2756  ' + ft + '  \u2756').width); }
    const w = Math.min(W - 100, tw + 260), x = cx - w / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#5a0f22'); g.addColorStop(0.5, '#8e1b33'); g.addColorStop(1, '#5a0f22');
    const r = two ? 50 : 58;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 6; ctx.strokeStyle = '#e8c16a'; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x + 12, y + 12, w - 24, h - 24, r - 12); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(247,215,116,0.6)'; ctx.stroke();
    const ly = two ? y + 62 : y + h / 2 + 4;
    const diya = (dx) => {
      const dy = ly + 10;
      ctx.beginPath(); ctx.ellipse(dx, dy, 34, 14, 0, 0, Math.PI); ctx.fillStyle = '#f2c14e'; ctx.fill();
      const fg = ctx.createRadialGradient(dx, dy - 30, 2, dx, dy - 26, 26); fg.addColorStop(0, '#fff6c8'); fg.addColorStop(0.5, '#ffb030'); fg.addColorStop(1, 'rgba(255,120,0,0)');
      ctx.beginPath(); ctx.moveTo(dx, dy - 58); ctx.quadraticCurveTo(dx + 16, dy - 26, dx, dy - 6); ctx.quadraticCurveTo(dx - 16, dy - 26, dx, dy - 58); ctx.fillStyle = fg; ctx.fill();
    };
    diya(x + 72); diya(x + w - 72);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 56px "Anek Malayalam"'; ctx.fillStyle = '#f7d774'; ctx.fillText(sp, cx, ly);
    if (two) {
      ctx.strokeStyle = 'rgba(247,215,116,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 220, y + 100); ctx.lineTo(cx + 220, y + 100); ctx.stroke();
      ctx.font = '700 42px "Anek Malayalam"'; ctx.fillStyle = '#fff3d6'; ctx.fillText('\u2756  ' + ft + '  \u2756', cx, y + 132);
    }
    ctx.restore();
  }
  if (dt && dt.length) {
    const W = 1440, cx = W / 2, n = dt.length, lh = 42, head = 46, h = 20 + head + n * lh, yb = 2540, y = yb - h;
    ctx.save();
    { const x0 = cx - 380, x1 = cx + 380;
      for (let yy = 2302; yy < 2545; yy++) { const a = ctx.getImageData(x0 - 2, yy, 1, 1).data, b = ctx.getImageData(x1 + 2, yy, 1, 1).data;
        const lg = ctx.createLinearGradient(x0, 0, x1, 0); lg.addColorStop(0, `rgb(${a[0]},${a[1]},${a[2]})`); lg.addColorStop(1, `rgb(${b[0]},${b[1]},${b[2]})`); ctx.fillStyle = lg; ctx.fillRect(x0, yy, x1 - x0, 1); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1f4d2b'; ctx.font = '700 34px "Anek Malayalam"'; ctx.fillText('കമ്പല്ലൂർ, കാസർഗോഡ് ജില്ല', cx, Math.min(2350, y) - 26); }
    let fs_ = 38; ctx.font = `700 ${fs_}px "Anek Malayalam"`;
    const maxw = W - 220; let tw = 0; for (const t of dt) tw = Math.max(tw, ctx.measureText(t).width);
    if (tw > maxw) { fs_ = Math.floor(fs_ * maxw / tw); ctx.font = `700 ${fs_}px "Anek Malayalam"`; tw = maxw; }
    ctx.font = '800 38px "Anek Malayalam"'; tw = Math.max(tw, ctx.measureText('\u2756  ഇന്നത്തെ പരിപാടികൾ  \u2756').width);
    const w = Math.min(W - 120, tw + 120), x = cx - w / 2;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#5a0f22'); g.addColorStop(0.5, '#8e1b33'); g.addColorStop(1, '#5a0f22');
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 36); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#e8c16a'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f7d774'; ctx.font = '800 38px "Anek Malayalam"'; ctx.fillText('\u2756  ഇന്നത്തെ പരിപാടികൾ  \u2756', cx, y + 10 + head / 2);
    ctx.fillStyle = '#fff3d6'; ctx.font = `700 ${fs_}px "Anek Malayalam"`;
    dt.forEach((t, i) => ctx.fillText(t, cx, y + 10 + head + lh * i + lh / 2));
    ctx.restore();
  }
  fs.mkdirSync(T + '/out', { recursive: true });
  const out = `${T}/out/Poster_${todayStr}_UltraHD.png`;
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(out);
})().catch(e => { console.error(e); process.exit(1); });
