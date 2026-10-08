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

## Flowchart lokal — 8 Oktober 2026

Pemeriksaan ini dijalankan pada branch `feat/flowchart` setelah seluruh implementasi Flowchart tanpa AI selesai. Bagian sebelumnya tetap menjadi evidence historis sesi lama dan tidak dianggap hasil perubahan ini.

| Gate | Hasil aktual |
| --- | --- |
| `npm run typecheck` (client/server/tests) | Exit 0 |
| `npm test` | Exit 0 — 90 tes pada 14 files, durasi 1,07 detik |
| `npm run build` | Exit 0; frontend built in 1,50 detik, warning ukuran chunk native tetap ada |
| `npm run test:e2e` (development) | Exit 0 — 45 tes, 1,5 menit |
| `INKSPIRE_TEST_MODE=production npm run test:e2e` | Exit 0 — 44 lulus + 1 di-skip, 56,9 detik |

Angka pada tabel ini adalah hasil implementasi awal; hasil fresh setelah perbaikan review ada di bagian **Perbaikan review Flowchart** di bawah.

Tes unit: `tests/flowchart-model.test.ts` (8), `tests/flowchart-text.test.ts` (11), `tests/flowchart-mermaid.test.ts` (26 → 39 setelah review), `tests/flowchart-insert.test.ts` (4). E2E: `tests/flowchart.e2e.ts` (13, satu di antaranya ditulis ulang pada review) dan `tests/flowchart-security.e2e.ts` (3 → 4 setelah review).

Pada tahap ini hasil async yang masih pending saat dialog ditutup dan workspace diganti hanya dibuktikan di development. Penundaan dibentuk lewat `page.route` pada modul converter lazy, yang di production di-inline bundler sehingga tesnya di-skip; production saat itu hanya tertutup kasus invalidasi input dan penggantian workspace bernama sama memakai converter asli hasil build. Klaim itu kemudian dikoreksi — lihat bagian review di bawah.

### Cakupan penerimaan yang dibuktikan browser

Seluruhnya memakai converter/editor nyata pada harness mock `4183`/`4184`, tanpa `.env` operator dan tanpa GPU nyata.

- Preview tidak mengubah canvas: scene sebelum dan sesudah preview identik; dialog native `ttd` tidak pernah ter-mount (MutationObserver mencatat 0 mount pada kedua jalur entry).
- Insertion: elemen baru >5, bukan image, satu anchor `customData.inkspireFlowchart`, seluruh elemen memakai `groupIds` diagram, semua `startBinding`/`endBinding`/`containerId`/`boundElements` menunjuk ID yang ada, satu undo mengembalikan scene awal, redo menghasilkan ID yang sama, lalu draft/reload/import mempertahankan field persistent.
- Dua insertion terpisah: ID dan group berbeda, tidak ada elemen hilang, total elemen dua kali lipat.
- Edit native: menggeser satu node dengan keyboard mempertahankan konektor ke ID tersebut, teks bound ikut relatif, dan sumber pada metadata tetap snapshot.
- Aset lama: import fixture dua gambar, tambah flowchart, export/reload → dataURL file asli tidak berubah.
- Lifecycle: edit input membuang preview dan men-disable Tambahkan; Escape mengembalikan fokus ke pemicu More Tools dan input bertahan; workspace pengganti bernama sama memicu `STALE` dan menolak insertion; object URL preview (`image/png`) direvoke saat diganti, dibuang, dan unmount.
- Local-only: tidak ada request ke origin non-loopback dan tidak ada request `/api/*` selama seluruh alur Flowchart; 0 dialog JavaScript; console error 0.
- Batas: 51 node, label 121 karakter, input 8.001 karakter, cabang kurang, referensi tak dikenal, indentasi bertingkat, tab, dan label HTML menghasilkan error bernomor baris sebelum preview; 101 edge pada tab Mermaid ditolak batas.
- UI: keyboard tab ArrowLeft/ArrowRight/Home/End, shortcut workspace tetap ter-guard saat modal terbuka, mengetik `r` di textarea tidak mengaktifkan tool persegi, warning struktur nonblocking, salin kode dengan fallback, light/dark/mobile 390 px tanpa overflow horizontal, dan pergantian bahasa mempertahankan sumber/ID/canvas sementara grammar Indonesia tetap diterima.

Tiga klaim pada daftar di atas tidak didukung bukti yang cukup dan baru diperbaiki setelah review: preservation lintas restore diukur dengan toleransi geometri global 5 px tanpa merinci field mana yang boleh bergerak, tes "edit native" ternyata menggeser seluruh grup sehingga tidak membuktikan perubahan satu node, dan hasil converter yang masuk canvas belum tentu memenuhi invariant origin panah. Detail koreksinya ada di bagian **Perbaikan review Flowchart**.

### Review visual

Screenshot diperiksa manual, bukan hanya disimpan: `output/flowchart/flowchart-more-tools.png` (entri Flowchart tanpa badge AI; entri Mermaid native tetap terlihat sebagai jalur terpisah), `flowchart-light.png`, `flowchart-dark.png`, dan `flowchart-mobile.png`. Light menampilkan dialog dua kolom dengan preview dan kode kanonik; dark memakai adaptasi CSS pada preview light; mobile satu kolom tanpa overflow. Artefak berada di `output/` yang dikecualikan Git dan tidak di-commit.

### Deviasi dan batas yang dicatat

- Contoh plan mengimpor `ExcalidrawElementSkeleton` dari `@excalidraw/excalidraw/element/transform`; path tipe itu tidak ada pada 0.18.1 sehingga dipakai `@excalidraw/excalidraw/data/transform`.
- `convertGraph` tidak menerima parameter tema. Preview selalu PNG light dan tema ditangani CSS, sesuai aturan bahwa pergantian tema tidak mengulang parsing.
- Entri cabang di luar blok (`Ya -> ...` tanpa indentasi) ditolak sebagai `BRANCHES`, bukan dianggap proses bernama `Ya`, mengikuti aturan grammar pada spec.
- Wrapper 2.2.2 tidak mendeklarasikan `securityLevel`/`htmlLabels`; tidak ada field di luar tipe yang ditambahkan. Yang dikirim hanya `startOnLoad`, `maxEdges`, `maxTextSize`, `flowchart.curve`, dan `themeVariables.fontSize`. Pertahanan utama adalah boundary input kanonik, dan hasil adversarial dibuktikan lewat browser tests di atas.
- Perbandingan scene lintas restore pada tahap ini memakai pencocokan field persistent dengan toleransi geometri 5 px, karena Excalidraw mengukur ulang bound text setelah font siap. ID, tipe, teks, group, binding, dan metadata dibandingkan persis. Setelah review pendekatan ini digantikan oleh pengukuran per tahap dengan pengecualian yang dinyatakan eksplisit.
- Pemeriksaan struktur tidak membuktikan kebenaran logika engineering; nested indentation, jenis diagram lain, dan sinkronisasi sumber↔canvas tetap di luar scope.

## Perbaikan review Flowchart — 8 Oktober 2026

Review terhadap branch `feat/flowchart` menghasilkan REQUEST_CHANGES dengan dua bug (F1, F2) dan tiga permintaan regression (V1, V2, V3). Gate di bawah adalah hasil fresh pada HEAD setelah perbaikan, dijalankan ulang dari working tree bersih.

| Gate | Hasil aktual |
| --- | --- |
| `npm run typecheck` (client/server/tests) | Exit 0 |
| `npm test` | Exit 0 — 103 tes pada 14 files, durasi 966 ms |
| `npm run build` | Exit 0; frontend built in 1,48 detik; warning ukuran chunk native dan catatan dynamic-import inline tetap ada |
| `npm run test:e2e` (development) | Exit 0 — 46 tes, 1,5 menit |
| `INKSPIRE_TEST_MODE=production npm run test:e2e` | Exit 0 — 45 lulus + 1 di-skip, 57,0 detik |

Suite Flowchart sekarang: unit `model` 8, `text` 11, `mermaid` 39, `insert` 4; E2E `flowchart.e2e.ts` 13 dan `flowchart-security.e2e.ts` 4. Satu-satunya skip adalah tes yang membentuk penundaan **impor modul** converter, yang membutuhkan code-splitting dev; hasil async yang benar-benar pending kini dibuktikan pada kedua mode lewat penahan `canvas.toBlob`.

**F1 — arrow yang masuk ke canvas melanggar invariant `points[0] === [0, 0]`.** Converter Mermaid mengembalikan titik pertama pada offset kecil (terdokumentasi pada probe reviewer: `points: [[0, 0.5], [-0.5, 24.5], [-0.5, 45]]`), dan Excalidraw hanya menyentuh kembali field itu ketika user membuka editor garis, sehingga `new LinearElementEditor` mencatat `Linear element is not normalized`. Perbaikan: `normalizeLinearElements` pada `src/features/flowchart/convert.ts` menggeser origin ke `[0, 0]` sambil memindahkan `x`/`y` dan menghitung ulang `width`/`height` dari bbox titik; dipanggil baik pada jalur preview maupun pada payload insertion, dan `assertOutput(..., normalized)` kini menolak panah yang origin-nya bukan `[0, 0]` supaya kegagalan muncul sebelum scene disentuh, bukan sebagai console error di kemudian hari.

**F2 — token Mermaid dengan dua deklarasi pada satu baris diterima diam-diam.** `readToken` sebelumnya hanya menguji prefix/suffix wrapper, sehingga `A["One"] B["Two"]` terbaca sebagai satu node berlabel `One"] B["Two`. Perbaikan: satu regexp jangkar per bentuk (`([...])`, `[...]`, `{...}`, `(...)`) yang harus cocok dengan **seluruh** token, dan kutip hanya diterima bila membungkus seluruh isi. Token campuran seperti `A[One]]`, `A[One})`, `A{One?} extra` kini `MERMAID_SYNTAX` dengan nomor baris (divalidasi pada baris 3), sementara `A["a]b"]` dan `A["Yes -> No"]` tetap valid karena wrapper diperiksa lebih dulu, bukan karakter di dalamnya.

### Regression yang ditambahkan dan apa yang dibuktikannya

- **V1 — pembanding scene per tahap.** Setiap field persistent dibandingkan: `x`, `y`, `width`, `height`, setiap `points[i][j]`, style, `text`/`originalText`, `seed`, `groupIds`, `containerId`, `boundElements`, `startBinding`/`endBinding`, dan `customData`. Yang dikecualikan hanya `version`, `versionNonce`, `updated` (bookkeeping sejarah). Setiap tahap dibandingkan dengan snapshot pendahulunya sendiri, bukan dengan snapshot insertion, sehingga penurunan hasil tidak menular antar tahap.
- Tahap `settle` (dua snapshot berturut-turut tanpa interaksi), `mutation` (klik area kosong), `reload` (draft IndexedDB), `import` (file `.excalidraw`), `asset-preserve`, `asset-reload`, dan `language` lulus pada delta 0; toleransi 1e-9 hanya untuk noise bit terakhir IEEE-754. Satu-satunya pengecualian yang dinyatakan adalah `redo`: replay undo→redo lewat sejarah Excalidraw menghitung ulang ujung panah yang terikat node, dengan delta terukur arrow.width 3,01, arrow.points 2,50, arrow.x 0,97, arrow.height 1,42, arrow.y 0,50, text.x 1,1e-13, dan angka itu stabil diulang beberapa kali. Batasnya 4 px, hanya untuk geometry bertipe `arrow`, sehingga pergeseran bentuk atau posisi node tetap gagal.
- Setelah replay, keadaan canvas terbukti stabil lagi: tahap sesudahnya kembali delta 0, dan seluruh arrow tetap `points[0] === [0, 0]`.
- **V2 — edit native yang sebenarnya.** Menu konteks **Pisahkan pilihan** dipakai dan keberhasilannya dibuktikan: semua `groupIds` kosong pada scene tersimpan dan tidak satu field geometri pun berubah. Setelah itu satu node digeser dengan keyboard, dan himpunan elemen yang bergerak harus persis `{node, label bound, konektor yang terikat}` — semua elemen lain delta 0, node dan label bergerak 8 px seirama, binding konektor tetap menunjuk ID yang sama, dan `points` konektor benar-benar berubah. Sumber `customData.inkspireFlowchart` tetap snapshot.
- Jalur F1 dibuka lewat kontrol native **Edit arrow**, lalu satu vertex di-drag; tes menuntut titik itu benar-benar berpindah (>5 px) supaya interaksi tidak lolos tanpa membuktikannya, dan `console`/`pageerror` dijaring pada dua tahap. Tidak ada `Linear element is not normalized`; error `Uncaught ReferenceError` editor juga tidak muncul.
- **V3 — hasil async pada production.** `HTMLCanvasElement.prototype.toBlob` ditahan, preview dibiarkan menggantung (`expect.poll` memastikan ekspor memang tertunda), dialog ditutup, workspace diganti, dialog dibuka lagi, baru hasil dilepas. Tidak ada preview yang muncul, **Tambahkan ke canvas** tetap disabled, dan canvas tetap kosong. Karena penahan berada di batas canvas dan bukan pada impor modul, tes ini berjalan sama di dev dan production.
- Unit: `tests/flowchart-mermaid.test.ts` menambah blok validasi token (7 bentuk campuran, termasuk verifikasi nomor baris) dan blok normalisasi elemen linear (pergeseran origin, perhitungan bbox, elemen yang sudah valid tidak disentuh, dan penolakan `assertOutput` untuk panah belum ternormalisasi).

### Batas yang diakui

- Pengecualian geometri `redo` adalah perilaku Excalidraw 0.18.1 pada jalur replay sejarah, bukan sesuatu yang bisa dihilangkan dari sisi kita; yang dibuktikan adalah bahwa state hasil replay stabil dan tersimpan persis.
- Pada dua tes yang melakukan drag lalu download, satu log internal Chromium (`Blocked attempt to show a 'beforeunload' confirmation panel`) dikecualikan lewat pola eksplisit karena berasal dari browser saat download harness bertemu guard beforeunload aplikasi. `Linear element is not normalized` tidak termasuk yang dikecualikan dan tidak pernah muncul.
- `structuredClone` sebelum `convertToExcalidrawElements` dihapus karena 0.18.1 sudah melakukan `cloneJSON(elementsSkeleton)` di dalam fungsi tersebut, sehingga skeleton preview tidak pernah dimutasi dan salinan kita hanya biaya tambahan.
