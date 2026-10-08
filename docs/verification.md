# Verifikasi MVP Inkspire

Artefak lokal historis telah dibersihkan sebelum push repository. Hasil di bawah adalah catatan pemeriksaan pada saat pekerjaan dilakukan; nama artefak dicatat sebagai teks dan file tersebut tidak disertakan di GitHub.

7 Oktober 2026. Node 24.17.0, Chromium Playwright 1.63.0, companion/mock loopback 4183/4184. Seluruh integration test memakai mock; environment operator dan GPU nyata tidak dipakai.

## Gate akhir

| Pemeriksaan | Hasil aktual |
| --- | --- |
| `rtk npm run typecheck` | Exit 0; client, server, dan tests |
| `rtk npm test` | Exit 0; 41 tests, 10 files |
| `rtk npm run build` | Exit 0; frontend dan compiled companion |
| `rtk npm run test:e2e` | Exit 0; 20 tests, 37.4 detik |
| `rtk proxy env INKSPIRE_TEST_MODE=production npm run test:e2e` | Exit 0; 20 tests, 23.2 detik |
| `npm ci`, `npm ls --all`, audit instalasi | Instalasi/tree valid; audit 0 temuan |

Build terakhir juga dijalankan dengan `MAPIC_SERVICE_TOKEN` sentinel khusus tes. Scan seluruh file `dist/` dan file workspace unduhan di `output/workspaces/` tidak menemukan sentinel. Request browser tidak memiliki Authorization; companion→mock memiliki Bearer yang diharapkan. Token operator tidak dibaca untuk pemeriksaan ini.

Log build dan browser terakhir: build (`output/build.log`), dev (`output/dev-e2e.log`), production (`output/production-e2e.log`). Artifact lokal dikecualikan dari Git. Build tetap memberi warning chunk native di atas 500 kB; entry sekitar 1.37 MB dan chunk subset font sekitar 1.82 MB sebelum gzip.

## Cakupan penerimaan

| Kriteria | Evidence |
| --- | --- |
| Canvas langsung, restore, AI tertutup | `editor.e2e.ts`, `workspace.e2e.ts`, `lifecycle.e2e.ts` |
| Native tools, properti, undo/redo | Drawing rectangle/arrow/text; native PNG undo/redo; screenshot seleksi |
| Tema sistem/manual tanpa mutasi scene | `visual.e2e.ts` media change/override; `workspace.e2e.ts` serialized colors |
| File native beraset round trip | `ai-insertion.e2e.ts`, multi-image import/save/reload di `workspace.e2e.ts` |
| Storage dan import failures/races | `draft.test.ts`, `autosave.test.ts`, read/quota injections di `lifecycle.e2e.ts` |
| Guard replace dan export | Simpan/ganti/batal, shortcut/drop; PNG/SVG penuh/seleksi, embedded images/fonts |
| T2I/I2I, batas input dan error | `request.test.ts`, `images.test.ts`, `mapic.test.ts`, `references.e2e.ts` |
| Tidak duplikasi/retry/progress palsu | Double-click counter 1; timeout/disconnect; explicit held mock dan 409 setelah reconnect |
| Preview/insertion/correct target | Scene sebelum/sesudah insertion; hash race guard; target confirmation dan Batal |
| Reload tanpa resubmit/recovery palsu | Held request tetap aktif di companion, draft pulih, preview tidak dipulihkan |
| Desktop/mobile dan akses file | 1280×800, 1440×1000, 390×844, light/dark; focus, sticky close, overflow/menu checks |
| Secret dan akses lokal | Host/Origin/media/body rejects, sensitive paths 404, sanitized malicious errors, sentinel scan |

Test browser menjalankan editor nyata dan companion; tidak mengganti API generation dengan `page.route`. Routing pada tes visual hanya memblokir request eksternal. Drawing teks dan export SVG font tetap bekerja offline tanpa error console.

## Review visual

Delapan screenshot berasal dari aplikasi production hasil build, dibandingkan dengan arah mockup yang disetujui:

- Desktop light (`output/playwright/1440-light-canvas.png`)
- Desktop dark/pending (`output/playwright/1440-dark-pending.png`)
- Seleksi dan properti native (`output/playwright/1280-dark-selection.png`)
- Mobile light (`output/playwright/390-light-canvas.png`)
- Mobile dark/pending (`output/playwright/390-dark-pending.png`)

Ikon tool aktif tetap terbaca; header drawer dan tombol tutup tetap terlihat saat scroll. Font UI/editor/worker disajikan lokal. Tidak ada horizontal overflow, request CDN, atau error console pada viewport yang diuji. Browser lain belum diuji.

## Perbaikan dan deviasi pelaksanaan

- Radix Tabs diperbarui lewat override untuk React 19. Override Nano ID, Sass, Lodash ES, dan KaTeX menutup temuan audit tanpa force/legacy-peer-deps.
- Guard `.vite` cache di development, stacking menu, recovery setelah IDB read failure, identity saat hash PNG, dan shortcut clear/drop diperbaiki berdasarkan regression.
- APNG ditolak eksplisit karena decoder dapat hanya melaporkan default frame.
- Worker font native dipisahkan dari graph UI setelah tes production membuktikan worker mengimpor browser entry. Dependency graph worker upstream disalin utuh; library tidak dimodifikasi.
- Timing tes 409 memakai held mock dan pelepasan eksplisit. Delay berbasis waktu sebelumnya dapat selesai sebelum tab kedua siap.
- Unit client AI ditambahkan setelah implementasi lalu diverifikasi green; urutan red→green untuk unit tersebut tidak dilakukan. Regression data/security/APNG dan kontras mempunyai failure yang direproduksi sebelum fix.

## Batas hasil

Integrasi MaPic T2I/I2I terbukti melalui mock, bukan GPU nyata. Konfigurasi backend asli dan smoke GPU perlu langkah tersendiri. License repository belum dipilih; notice dependency/font disertakan. MCP, perubahan MaPic, Git init/commit/push, subagent, dan publikasi tidak dilakukan.

## Review UI — 8 Oktober 2026

Scope: outline pilihan properti teks/guratan, pilihan Indonesia/English, setup MaPic melalui `.env` yang diisi pengguna, dan preview tema dahulu. Tema header aplikasi menunggu pilihan A/B/C; prototype tersedia di `/previews/ink-theme.html`.

| Gate | Hasil aktual |
| --- | --- |
| Typecheck client/server/tests | Exit 0, log (`output/ui-review-typecheck.log`) |
| Unit/HTTP | Exit 0, 41 tests/10 files |
| Build frontend/companion | Exit 0, log (`output/ui-review-build.log`); warning chunk native besar tetap ada |
| E2E dev, source final | Exit 0, 24 tests/46.2 detik, log (`output/ui-review-dev.log`) |
| E2E compiled production, source final | Exit 0, 24 tests/29.1 detik, log (`output/ui-review-production.log`) |
| Scan sentinel tes pada build | 662 files, 0 matches |

`ui-review.e2e.ts` membuktikan pergantian bahasa tidak mereset scene, aset gambar, undo, nama workspace, atau prompt; preferensi bertahan setelah reload. Error AI diterjemahkan tanpa mengulang request. Scene dibandingkan utuh sebelum/sesudah pergantian; setelah reload hanya empty bindings `null`/`[]` dinormalisasi mengikuti native restore. Mobile English tidak overflow.

Outline native aktif mengikuti pilihan warna/font/ukuran/perataan/guratan, tampil ketika fokus berpindah, dan terbaca di light/dark. Audit screenshot menemukan hover shell menutupi swatch; CSS diperbaiki dan regression memeriksa warna asli saat hover. Outline swatch mengikuti filter native agar tetap terang di dark mode.

Preview SVG/CSS menguji ketiga animasi dua arah, klik cepat tanpa layer tertinggal, Space/fokus keyboard, reduced motion, dan mobile. Light (`output/playwright/ink-theme-preview-light.png`), dark (`output/playwright/ink-theme-preview-dark.png`), mobile (`output/playwright/ink-theme-preview-mobile.png`). Screenshot aplikasi final: properti light (`output/playwright/review-text-light.png`), properti dark (`output/playwright/review-text-dark.png`), English mobile (`output/playwright/review-english-mobile.png`).

Backend sudah memiliki alur companion→MaPic. Template `.env` kosong dibuat secara eksklusif tanpa menimpa file yang ada; pengguna mengisi `MAPIC_BASE_URL` dan `MAPIC_SERVICE_TOKEN` sendiri, lalu restart dev. Nilai kredensial operator dan `temp/image-gen.txt` tidak dibaca. Semua generation tes memakai mock, tanpa GPU nyata. Red regression bahasa mereproduksi pilihan yang belum tersedia; outline direproduksi lewat audit browser sebelum CSS. Prototype mendapat regression setelah implementasi.

## Integrasi tema A — 8 Oktober 2026

Pengguna memilih A untuk header app. Ikon Ink berisi tinta menjadi tombol Light/Dark, dengan reveal organik 650 ms dan gerak tetes. Dropdown tema footer digantikan checkbox **Ikuti sistem**. Nama tombol bilingual menyebut tema tujuan; `aria-pressed` mengikuti mode dark dan guard menahan klik berulang.

Implementasi memakai snapshot View Transition browser serta commit React sinkron, tanpa clone/remount editor. `ink-theme.e2e.ts` memverifikasi scene dan aset utuh, undo tetap tersedia, AI pending dan prompt bertahan, satu request generation, override tersimpan setelah reload, serta kembali mengikuti perubahan OS. Tes juga membuktikan animasi polygon benar-benar berjalan pada desktop/mobile, klik cepat tidak berlipat, keyboard/fokus English, reduced motion, API tidak tersedia, dan transition skipped/interupsi melepas guard tanpa error browser.

| Gate terbaru | Hasil aktual |
| --- | --- |
| Typecheck client/server/tests | Exit 0 |
| Unit/HTTP | Exit 0, 41 tests/10 files |
| Build | Exit 0, log (`output/ink-theme-build.log`); warning chunk native besar tetap ada |
| E2E dev | Exit 0, 29 tests/1.0 menit, log (`output/ink-theme-dev.log`) |
| E2E compiled production | Exit 0, 29 tests/42.7 detik, log (`output/ink-theme-production.log`) |
| Scan sentinel build | 662 files, 0 matches |

Artifact aplikasi production: bloom desktop (`output/playwright/ink-header-1280-bloom.png`), bloom mobile (`output/playwright/ink-header-390-bloom.png`), mobile English/reduced motion (`output/playwright/ink-header-mobile.png`). Frame bloom diambil dengan animation dipause pada 100 ms, lalu dilanjutkan sampai cleanup; ini screenshot animasi aplikasi nyata.

Tiga regression header mula-mula gagal karena tombol belum tersedia, lalu lulus setelah integrasi. Pemeriksaan reduced motion dibatasi pada animasi Ink/View Transition karena editor memiliki animasi native lain. Chromium diuji; browser tanpa API memakai fallback instan, bukan klaim seluruh browser sudah diuji. Generation tetap memakai mock; kredensial operator, GPU nyata, Git/publikasi dan subagent tidak dipakai.

## Generation MaPic nyata — 8 Oktober 2026

Pengguna mengizinkan generation GPU nyata hingga berhasil. Companion dan panggilan langsung awalnya ditolak HTTP401 (`Invalid service token`). Token `.env` Inkspire berbeda dari token runtime container backend MaPic; nilainya disamakan melalui SSH read-only, tanpa dicetak atau mengubah server MaPic. Companion dimulai kembali agar memuat konfigurasi baru.

Tes melalui tombol **Generate image** di app nyata menghasilkan HTTP200 dengan satu request,40steps/CFG1/resolusi1024, dalam **34,611detik**. Preview termuat1024×1024 dan **Unduh PNG** berhasil. PNG1.301.945bytes lolos validasi/decode penuh companion. Hasil PNG (`output/mapic-live-generation.png`), bukti UI (`output/playwright/mapic-live-success.png`), metadata tersanitasi (`output/mapic-live-check.json`).

Tidak ada perubahan source pada diagnosis ini, sehingga gate source sebelumnya tidak diulang. Verifikasi nyata ini mencakup T2I; I2I tetap memiliki bukti suite mock. Token hanya berada dalam konfigurasi backend lokal; tidak disalin ke artifact atau dokumen.

## Gate sebelum initial push — 8 Oktober 2026

Pengguna memilih Apache-2.0 dan meminta pembersihan artefak sebelum push. Pemeriksaan baru dijalankan pada source final dan metadata lisensi yang diperbarui.

| Gate | Hasil aktual |
| --- | --- |
| Typecheck client/server/tests | Exit 0 |
| Unit/HTTP | Exit 0, 41 tes/10 files |
| Build frontend/companion | Exit 0; warning ukuran chunk native tetap ada |
| E2E development | Exit 0, 29 tes/1,0 menit |
| E2E compiled production | Exit 0, 29 tes/41,4 detik |
| Scan credential pada build/fixture | 662 file build dan 82 fixture workspace; 0 matches |
| Scan staged files | 565 file; 0 token/URL operator dan 0 path yang harus dikecualikan |

Tes HTTP awal pada sandbox ditolak EPERM saat bind loopback; suite yang sama dijalankan kembali dengan izin loopback dan seluruh tes lulus. Whitespace source/dokumen first-party bersih; teks notice/aset upstream dipertahankan tanpa normalisasi. Semua artefak tes baru dibersihkan setelah pemeriksaan. Isi temp tetap utuh menurut inventaris path, ukuran, dan mtime. Suite otomatis memakai mock; tidak menjalankan generation GPU tambahan.
