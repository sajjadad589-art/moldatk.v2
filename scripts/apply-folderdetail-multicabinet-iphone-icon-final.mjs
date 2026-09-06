import fs from 'node:fs';
import zlib from 'node:zlib';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

// -----------------------------------------------------------------------------
// 1) FolderDetailModal: replace the single-cabinet select with a true multi-select
//    dropdown made of checkboxes, including an explicit "الكل" option.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/FolderDetailModal.tsx';
  let src = read(path);

  if (!src.includes("from '../lib/collectorCloud'")) {
    const anchor = "import { formatCurrency, formatNumberArabic } from '../utils/formatters';";
    must(src.includes(anchor), 'FolderDetailModal import anchor missing');
    src = src.replace(anchor, `${anchor}\nimport { syncCloudCollectorRoster } from '../lib/collectorCloud';`);
  }

  if (!src.includes('assignedLineIds: currentLines[0]?.id ? [currentLines[0].id] : [],')) {
    src = src.replace(
      "      assignedLineId: currentLines[0]?.id || 'line-1',\n      assignedLineName: currentLines[0]?.name || 'الخط الرئيسي',",
      "      assignedLineId: currentLines[0]?.id || undefined,\n      assignedLineName: currentLines[0]?.name || undefined,\n      assignedLineIds: currentLines[0]?.id ? [currentLines[0].id] : [],\n      assignedAllLines: false,"
    );
  }

  const singleSelectBlock = `                        <div>\n                          <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-bold">\n                            الخط المخصص\n                          </label>\n                          <select\n                            value={c.assignedLineId}\n                            onChange={e => {\n                              const line = currentLines.find(l => l.id === e.target.value);\n                              handleUpdateCollector(c.id, {\n                                assignedLineId: e.target.value,\n                                assignedLineName: line?.name || 'الخط المخصص',\n                              });\n                            }}\n                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"\n                          >\n                            {currentLines.map(l => (\n                              <option key={l.id} value={l.id}>\n                                {l.name}\n                              </option>\n                            ))}\n                          </select>\n                        </div>`;

  if (src.includes(singleSelectBlock)) {
    const multiSelectBlock = `                        <div className="relative">\n                          <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-bold">\n                            الكابينات المخصصة\n                          </label>\n                          {(() => {\n                            const selectedIds = Array.isArray(c.assignedLineIds) && c.assignedLineIds.length\n                              ? c.assignedLineIds\n                              : (c.assignedLineId ? [c.assignedLineId] : []);\n                            const allSelected = c.assignedAllLines === true || (!selectedIds.length && !c.assignedLineId);\n                            const selectedNames = currentLines.filter(line => selectedIds.includes(line.id)).map(line => line.name);\n                            const label = allSelected\n                              ? 'الكل'\n                              : selectedNames.length === 0\n                                ? 'اختر الكابينات'\n                                : selectedNames.length === 1\n                                  ? selectedNames[0]\n                                  : \`\${selectedNames.length} كابينات محددة\`;\n\n                            return (\n                              <details className="group relative">\n                                <summary className="list-none cursor-pointer w-full min-h-[38px] px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#F2B544]/50 flex items-center justify-between gap-2">\n                                  <span className="truncate">{label}</span>\n                                  <span className="text-slate-400 group-open:rotate-180 transition-transform">⌄</span>\n                                </summary>\n\n                                <div className="absolute z-30 mt-1 w-full min-w-[220px] max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2 space-y-1">\n                                  <label className={\`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer border text-xs font-black transition-all \${allSelected ? 'bg-[#FFF7E3] border-[#D89A21] text-[#0B1F3B]' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}\`}>\n                                    <input\n                                      type="checkbox"\n                                      checked={allSelected}\n                                      onChange={e => {\n                                        if (e.target.checked) {\n                                          handleUpdateCollector(c.id, {\n                                            assignedAllLines: true,\n                                            assignedLineIds: [],\n                                            assignedLineId: undefined,\n                                            assignedLineName: 'كل الكابينات',\n                                          });\n                                        } else {\n                                          handleUpdateCollector(c.id, {\n                                            assignedAllLines: false,\n                                            assignedLineIds: [],\n                                            assignedLineId: undefined,\n                                            assignedLineName: undefined,\n                                          });\n                                        }\n                                      }}\n                                      className="w-4 h-4 accent-[#0B1F3B]"\n                                    />\n                                    <span>الكل</span>\n                                  </label>\n\n                                  {currentLines.map(line => {\n                                    const checked = !allSelected && selectedIds.includes(line.id);\n                                    return (\n                                      <label key={line.id} className={\`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer border text-xs font-bold transition-all \${checked ? 'bg-[#FFF7E3] border-[#D89A21] text-[#0B1F3B]' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}\`}>\n                                        <input\n                                          type="checkbox"\n                                          checked={checked}\n                                          onChange={() => {\n                                            const base = allSelected ? [] : selectedIds;\n                                            const nextIds = checked\n                                              ? base.filter(id => id !== line.id)\n                                              : [...base, line.id];\n                                            const first = currentLines.find(item => item.id === nextIds[0]);\n                                            handleUpdateCollector(c.id, {\n                                              assignedAllLines: false,\n                                              assignedLineIds: nextIds,\n                                              assignedLineId: first?.id,\n                                              assignedLineName: first?.name,\n                                            });\n                                          }}\n                                          className="w-4 h-4 accent-[#0B1F3B]"\n                                        />\n                                        <span className="truncate">{line.name}</span>\n                                      </label>\n                                    );\n                                  })}\n                                </div>\n                              </details>\n                            );\n                          })()}\n                        </div>`;
    src = src.replace(singleSelectBlock, multiSelectBlock);
  }

  // Save the collector roster through the server so assignments are not local-only.
  if (!src.includes("Collector roster save failed in FolderDetailModal")) {
    const oldSave = `  const handleSave = () => {\n    if (folderKey === 'generator_specs') {\n      onUpdateGeneratorSpecs(specs);\n    } else if (folderKey === 'lines_zones') {\n      onUpdateLines(currentLines);\n    } else if (folderKey === 'collectors') {\n      onUpdateCollectors(currentCollectors);\n    } else if (folderKey === 'invoices_templates') {\n      onUpdateInvoiceTemplate(currentTemplate);\n    }\n\n    setSaved(true);\n    setTimeout(() => {\n      setSaved(false);\n      onClose();\n    }, 600);\n  };`;

    must(src.includes(oldSave), 'FolderDetailModal handleSave block missing');
    const newSave = `  const handleSave = async () => {\n    try {\n      if (folderKey === 'generator_specs') {\n        onUpdateGeneratorSpecs(specs);\n      } else if (folderKey === 'lines_zones') {\n        onUpdateLines(currentLines);\n      } else if (folderKey === 'collectors') {\n        const invalidCollector = currentCollectors.find(c => {\n          const ids = Array.isArray(c.assignedLineIds) && c.assignedLineIds.length\n            ? c.assignedLineIds\n            : (c.assignedLineId ? [c.assignedLineId] : []);\n          const all = c.assignedAllLines === true || (!ids.length && !c.assignedLineId);\n          return !all && ids.length === 0;\n        });\n        if (invalidCollector) {\n          alert(\`حدد كابينة واحدة على الأقل للجابي \"\${invalidCollector.name}\" أو اختر الكل.\`);\n          return;\n        }\n        const savedCollectors = await syncCloudCollectorRoster(currentCollectors);\n        onUpdateCollectors(savedCollectors.length ? savedCollectors : currentCollectors);\n      } else if (folderKey === 'invoices_templates') {\n        onUpdateInvoiceTemplate(currentTemplate);\n      }\n\n      setSaved(true);\n      setTimeout(() => {\n        setSaved(false);\n        onClose();\n      }, 600);\n    } catch (error) {\n      console.error('Collector roster save failed in FolderDetailModal:', error);\n      alert('تعذر حفظ التغييرات على السيرفر. تحقق من الاتصال ثم حاول مرة أخرى.');\n    }\n  };`;
    src = src.replace(oldSave, newSave);
  }

  write(path, src);
}

// -----------------------------------------------------------------------------
// 2) iPhone/PWA icon: generate PNG files from the same generator mark language
//    used by the approved Moldatk brand. This removes the old blue placeholder.
// -----------------------------------------------------------------------------
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let c = 0xFFFFFFFF;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
};

const makeBrandIcon = (size) => {
  const pixels = Buffer.alloc(size * size * 4, 255);
  const rgba = (hex) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
  };
  const NAVY = rgba('#0B1F3B');
  const GOLD = rgba('#F2B544');
  const GOLD2 = rgba('#D89A21');
  const WHITE = rgba('#F8FAFC');

  const setPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (Math.floor(y) * size + Math.floor(x)) * 4;
    pixels[i] = color[0]; pixels[i + 1] = color[1]; pixels[i + 2] = color[2]; pixels[i + 3] = color[3];
  };
  const rect = (x, y, w, h, color) => {
    const x0 = Math.max(0, Math.floor(x)); const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(size, Math.ceil(x + w)); const y1 = Math.min(size, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy += 1) for (let xx = x0; xx < x1; xx += 1) setPixel(xx, yy, color);
  };
  const roundRect = (x, y, w, h, r, color) => {
    const rr = Math.max(1, r);
    for (let yy = Math.floor(y); yy < Math.ceil(y + h); yy += 1) {
      for (let xx = Math.floor(x); xx < Math.ceil(x + w); xx += 1) {
        const cx = xx < x + rr ? x + rr : xx > x + w - rr ? x + w - rr : xx;
        const cy = yy < y + rr ? y + rr : yy > y + h - rr ? y + h - rr : yy;
        const dx = xx - cx; const dy = yy - cy;
        if (dx * dx + dy * dy <= rr * rr) setPixel(xx, yy, color);
      }
    }
  };

  // Clean light tile; iOS supplies the outer rounded mask.
  rect(0, 0, size, size, WHITE);
  const x = size * 0.14, y = size * 0.30, w = size * 0.72, h = size * 0.40;
  const border = Math.max(3, size * 0.035);
  roundRect(x, y, w, h, size * 0.055, NAVY);
  roundRect(x + border, y + border, w - border * 2, h - border * 2, size * 0.03, WHITE);

  // Gold generator side panel.
  rect(x + w * 0.62, y + border, w * 0.38 - border, h - border * 2, GOLD);

  // Handle.
  rect(x + w * 0.22, y - size * 0.085, w * 0.30, border, NAVY);
  rect(x + w * 0.22, y - size * 0.085, border, size * 0.085, NAVY);
  rect(x + w * 0.52 - border, y - size * 0.085, border, size * 0.085, NAVY);

  // Vent lines.
  const ventX = x + w * 0.14;
  for (const offset of [0.25, 0.46, 0.67]) rect(ventX, y + h * offset, w * 0.28, Math.max(2, size * 0.018), NAVY);

  // Simple lightning mark on the gold panel.
  const bx = x + w * 0.74, by = y + h * 0.22;
  const bolt = [
    [0.10, 0.00], [0.00, 0.42], [0.10, 0.42], [0.02, 0.90], [0.34, 0.36], [0.21, 0.36], [0.34, 0.00],
  ];
  // Rasterize polygon using scanline point-in-polygon.
  const poly = bolt.map(([px, py]) => [bx + px * w * 0.42, by + py * h * 0.62]);
  const minX = Math.floor(Math.min(...poly.map(p => p[0]))), maxX = Math.ceil(Math.max(...poly.map(p => p[0])));
  const minY = Math.floor(Math.min(...poly.map(p => p[1]))), maxY = Math.ceil(Math.max(...poly.map(p => p[1])));
  for (let yy = minY; yy <= maxY; yy += 1) {
    for (let xx = minX; xx <= maxX; xx += 1) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        const intersect = ((yi > yy) !== (yj > yy)) && (xx < (xj - xi) * (yy - yi) / ((yj - yi) || 1) + xi);
        if (intersect) inside = !inside;
      }
      if (inside) setPixel(xx, yy, NAVY);
    }
  }

  // Feet + gold base accent.
  rect(x + w * 0.12, y + h, w * 0.13, size * 0.055, NAVY);
  rect(x + w * 0.72, y + h, w * 0.13, size * 0.055, NAVY);
  rect(x - size * 0.02, y + h + size * 0.07, w + size * 0.04, Math.max(3, size * 0.025), GOLD2);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let yy = 0; yy < size; yy += 1) {
    const rowOffset = yy * (size * 4 + 1);
    raw[rowOffset] = 0;
    pixels.copy(raw, rowOffset + 1, yy * size * 4, (yy + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/moldatk-icon-180-v1318.png', makeBrandIcon(180));
fs.writeFileSync('public/icons/moldatk-icon-192-v1318.png', makeBrandIcon(192));
fs.writeFileSync('public/icons/moldatk-icon-512-v1318.png', makeBrandIcon(512));

{
  const path = 'index.html';
  let src = read(path);
  src = src.replace(/<link rel="apple-touch-icon"[^>]*>/g, '<link rel="apple-touch-icon" sizes="180x180" href="/icons/moldatk-icon-180-v1318.png" />');
  if (!src.includes('rel="icon" type="image/png"')) {
    src = src.replace('<link rel="manifest" href="/manifest.webmanifest" />', '<link rel="manifest" href="/manifest.webmanifest" />\n    <link rel="icon" type="image/png" sizes="192x192" href="/icons/moldatk-icon-192-v1318.png" />');
  } else {
    src = src.replace(/<link rel="icon"[^>]*>/g, '<link rel="icon" type="image/png" sizes="192x192" href="/icons/moldatk-icon-192-v1318.png" />');
  }
  write(path, src);
}

{
  const path = 'public/manifest.webmanifest';
  const manifest = JSON.parse(read(path));
  manifest.background_color = '#F8FAFC';
  manifest.theme_color = '#0B1F3B';
  manifest.icons = [
    { src: '/icons/moldatk-icon-192-v1318.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/moldatk-icon-512-v1318.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/moldatk-icon-512-v1318.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ];
  write(path, JSON.stringify(manifest, null, 2) + '\n');
}

// -----------------------------------------------------------------------------
// 3) Android Gradle typo guard: the last failed build referenced a non-existent
//    variable; always normalize it before Gradle runs.
// -----------------------------------------------------------------------------
{
  const path = 'android/app/build.gradle';
  let src = read(path);
  src = src.replaceAll('androidxTestEspressoCoreVersion', 'androidxEspressoCoreVersion');
  write(path, src);
}

// Final guards.
const folder = read('src/components/FolderDetailModal.tsx');
const index = read('index.html');
const manifest = read('public/manifest.webmanifest');
const gradle = read('android/app/build.gradle');
must(folder.includes('كابينات محددة') && folder.includes('>الكل</span>') && folder.includes('syncCloudCollectorRoster'), 'FolderDetail multi-cabinet dropdown/server save missing');
must(index.includes('moldatk-icon-180-v1318.png') && index.includes('moldatk-icon-192-v1318.png'), 'iPhone/browser brand icon links missing');
must(manifest.includes('moldatk-icon-512-v1318.png'), 'PWA brand icon manifest missing');
must(fs.existsSync('public/icons/moldatk-icon-180-v1318.png') && fs.statSync('public/icons/moldatk-icon-180-v1318.png').size > 1000, 'Generated iPhone icon missing');
must(gradle.includes('androidxEspressoCoreVersion') && !gradle.includes('androidxTestEspressoCoreVersion'), 'Android Gradle Espresso variable still broken');

console.log('Applied FolderDetail multi-cabinet checkbox dropdown, server save, matching iPhone/PWA icon and Gradle build guard.');
