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
- Jalur F1 dibuka lewat kontrol native **Edit arrow**, lalu satu vertex di-drag; tes menuntut titik itu benar-benar berpindah (>5 px) supaya interaksi tidak lolos tanpa membuktikannya, dan `console`/`pageerror` dijaring pada dua tahap. Tidak ada `Linear element is not normalized` pada tahap seleksi maupun setelah drag.
- **V3 — hasil async pada production.** `HTMLCanvasElement.prototype.toBlob` ditahan, preview dibiarkan menggantung (`expect.poll` memastikan ekspor memang tertunda), dialog ditutup, workspace diganti, dialog dibuka lagi, baru hasil dilepas. Tes lalu **menunggu controller benar-benar selesai** lewat tombol **Buat preview** yang kembali muncul dan enabled — sinyal yang hanya hadir setelah `generate()` melewati pengecekan `live()` dan `finally` mereset `busy`. Assertion negatif baru dijalankan sesudah itu: tidak ada preview yang muncul, **Tambahkan ke canvas** tetap disabled, dan canvas tetap kosong. Antrean hold yang kosong tidak dipakai sebagai sinyal, karena itu hanya berarti callback sudah dijadwalkan. Karena penahan berada di batas canvas dan bukan pada impor modul, tes ini berjalan sama di dev dan production.
- Unit: `tests/flowchart-mermaid.test.ts` menambah blok validasi token (7 bentuk campuran, termasuk verifikasi nomor baris) dan blok normalisasi elemen linear (pergeseran origin, perhitungan bbox, elemen yang sudah valid tidak disentuh, dan penolakan `assertOutput` untuk panah belum ternormalisasi).

### Batas yang diakui

- Pengecualian geometri `redo` adalah perilaku Excalidraw 0.18.1 pada jalur replay sejarah. Yang terukur: tiga siklus undo→redo pada scene yang sama, delta terbesar dari insertion `arrow.width` 3,002894287382631 px; siklus kedua dan ketiga tidak menambah delta di atas `1e-9` pada kasus itu, jadi tidak terlihat drift berakumulasi; keenam panah tetap `points[0] === [0, 0]` pada tiap replay dan geometri node tidak bergeser. Tahap mutation, reload, import, aset, dan bahasa tetap dibandingkan ketat. Batas ini menerima keterbatasan pada contoh dan versi saat ini: ini bukan bukti bahwa undo→redo identik dengan insertion, bukan jaminan untuk seluruh graph, dan bukan bukti bahwa penyesuaian tersebut mustahil diperbaiki di sisi aplikasi.
- Pada dua tes yang melakukan drag lalu download, satu log internal Chromium (`Blocked attempt to show a 'beforeunload' confirmation panel`) dikecualikan lewat pola eksplisit karena berasal dari browser saat download harness bertemu guard beforeunload aplikasi. `Linear element is not normalized` tidak termasuk yang dikecualikan dan tidak pernah muncul.
- `structuredClone` sebelum `convertToExcalidrawElements` dihapus karena 0.18.1 sudah melakukan `cloneJSON(elementsSkeleton)` di dalam fungsi tersebut, sehingga skeleton preview tidak pernah dimutasi dan salinan kita hanya biaya tambahan.

## Akses LAN HTTPS — 8 Oktober 2026

Implementasi pada branch `feat/network-access`. Hasil di bawah adalah gate otomatis yang benar-benar dijalankan pada sesi ini; sign-off perangkat nyata dicatat terpisah dan masih **pending**.

### Gate otomatis

| Gate | Hasil aktual |
| --- | --- |
| `rtk npm run typecheck` | Exit 0; client, server, dan tests |
| `rtk npm test` | Exit 0 — 118 tests pada 17 files, durasi 978 ms |
| `rtk npm run build` | Exit 0; frontend built in 1,53 detik; companion compiled |
| `rtk npm run test:e2e` (development) | Exit 0 — 46 tests, 1,6 menit |
| `rtk proxy env INKSPIRE_TEST_MODE=production npm run test:e2e` | Exit 0 — 45 lulus + 1 di-skip, 56,0 detik |
| `rtk git diff --check` | Exit 0; tanpa whitespace error |

Unit LAN tambahan: `tests/network-origin.test.ts` 4 tests, `tests/network-companion.test.ts` 4 tests, `tests/network-config.test.ts` 7 tests. Suite default tidak memerlukan executable Caddy.

### Gate Caddy nyata — belum dijalankan (8 Oktober 2026; catatan historis)

> Status ini adalah hasil sesi 8 Oktober dan tidak lagi menjadi status terkini. Gate Caddy nyata dijalankan pada 9 Oktober 2026 setelah perbaikan review; lihat bagian **Perbaikan review LAN HTTPS — 9 Oktober 2026** di bawah.

`rtk npm run test:lan` **tidak dapat dijalankan** pada mesin ini: executable `caddy` tidak ada di PATH (`which caddy` kosong). Gate gagal cepat dan eksplisit dengan pesan `Caddy executable required for test:lan` dan exit 1, sesuai kontrak plan; fixture dihapus bersih dan tidak ada listener tersisa. Script Inkspire tidak memasang binary global secara otomatis, sehingga instalasi Caddy adalah keputusan operator.

Karena binary belum ada, bukti berikut **belum** tersedia dan tidak boleh dianggap lulus: adaptasi/validasi config lewat Caddy, verifikasi rantai TLS dan hostname, penolakan CA salah dengan kode error TLS, asset frontend melalui TLS, dan shutdown child saat foreground. Harness `tests/network-caddy.ts` sudah ditulis lengkap dan typecheck lulus, tetapi belum dieksekusi sampai Caddy terpasang.

Versi Caddy yang dipakai gate: **belum tercatat** karena executable tidak tersedia.

### Negative control yang dijalankan

| Mutasi sementara | Hasil |
| --- | --- |
| `server/app.ts`: hapus preservasi origin HTTPS setelah `listen()` | `tests/network-companion.test.ts` gagal 2 tests (`preserve HTTPS origin…`, `two clients share one generation slot`) |
| `server/lan.ts`: `bind` diganti `0.0.0.0` | `tests/network-config.test.ts` gagal pada `explicit interface and no implicit localhost or wildcard fallback` |

Kedua mutasi hanya berlaku pada working diff, dijalankan pada working diff, lalu hunk dipulihkan tepat. Working tree kembali hijau setelah tiap mutasi dan tidak ada hasil mutasi yang di-commit.

### Bukti runtime lain

- Listener companion tetap `127.0.0.1` dengan origin HTTPS kanonis dipertahankan; origin default localhost memakai port ephemeral aktual dari `server.address()`.
- Guard: Host salah, Origin `http://` pada port sama, Origin IP berbeda, Origin `null`, dan kombinasi `X-Forwarded-Host`/`X-Forwarded-Proto`/`Forwarded` semuanya ditolak 403 tanpa menyentuh mock.
- Slot generation global per companion: request kedua 409 `REQUEST_ACTIVE` dan jumlah call mock tidak bertambah.
- Path privat `/.inkspire-lan/Caddyfile`, `/.inkspire-lan/data/pki/authorities/local/root.key`, dan `/.env` tetap 404.
- CLI: IP tidak terpasang keluar nonzero dengan `IP LAN tidak terpasang pada host.` dan tidak menulis folder `.inkspire-lan`; argument tak dikenal keluar nonzero; konfigurasi localhost keluar nonzero dengan `Konfigurasi LAN production diperlukan.`; tanpa Caddy di PATH, `lan:serve` keluar 1 dengan pesan ringkas; `--write-only` keluar 0 tanpa menjalankan Caddy. Folder `.inkspire-lan` ditulis mode `0700` dan Caddyfile mode `0600`.
- Child Caddy menerima environment whitelist: `MAPIC_BASE_URL`, `MAPIC_SERVICE_TOKEN`, dan secret lain tidak ikut; `XDG_DATA_HOME`/`XDG_CONFIG_HOME` diarahkan ke `.inkspire-lan`.
- `git check-ignore` mengonfirmasi `.inkspire-lan/Caddyfile` dan `.inkspire-lan/data/pki/authorities/local/root.key` tidak pernah masuk Git.

### Sign-off perangkat nyata — pending

Belum ada device/browsers yang menguji mode LAN. Skenario yang tersisa:

| Skenario manual | Expected |
| --- | --- |
| Buka URL LAN pada dua device setelah CA dipercaya | Tidak ada warning TLS; `window.isSecureContext === true` |
| `crypto.randomUUID()` dan `crypto.subtle.digest` pada origin LAN | Keduanya tersedia tanpa warning |
| Buat rectangle/teks, reload pada device A | Draft A restore; device B tetap punya draft sendiri |
| Export A → import B | Scene dan aset tetap editable; tidak ada auto-sync |
| Flowchart → preview → insertion → undo/redo | Bentuk dan konektor native normal |
| Upload PNG/JPEG lalu generate dengan mock | Referensi ter-hash, preview dan insertion benar |
| Dua browser generate saat mock di-hold | Request pertama tetap pending selama mock di-hold; request kedua menerima 409 `REQUEST_ACTIVE`; setelah release, request pertama menerima 200. Hanya satu call mock sebelum release |
| Bahasa dan ikon Ink | Pergantian bahasa/tema berfungsi; canvas tetap ada |
| Origin/IP salah dan URL sensitif | Ditolak; data privat tidak disajikan |
| Kembali ke localhost setelah stop | Runtime pulih; draft tiap origin tetap tersimpan |

Nilai IP interface, port companion, dan port proxy harus dipilih pengguna, begitu juga pemasangan trust certificate pada device. Harness `tests/start-lan-acceptance.ts` menyiapkan instance terisolasi dengan CA acceptance sendiri; CA acceptance berbeda dari CA production dan trust device tetap tindakan manual.

## Perbaikan review LAN HTTPS — 9 Oktober 2026

Review 8 Oktober menyatakan REQUEST CHANGES: gate Caddy nyata gagal karena HTTP Host non-canonical menerima respons kosong 200 dari Caddy (R1), dokumentasi mengklaim gate sudah terverifikasi (R2), dan WORKFLOW tidak memulai companion (R3). Catatan 8 Oktober di atas dipertahankan sebagai hasil historis; bagian ini mencatat state setelah perbaikan.

### Perilaku yang ditambahkan

`renderCaddyfile` menulis site fallback `https://:<port>` dengan `bind` IP LAN yang sama dan `respond 403`, di bawah site kanonis yang tetap `reverse_proxy`. Hasil `caddy adapt` untuk config operator: satu server `srv0` dengan `listen: ["<ip>:<port>"]`, route pertama matcher `host: [<ip>]` menuju `reverse_proxy`, route kedua tanpa matcher menuju `static_response` 403. Tidak ada wildcard bind, port tambahan, atau fallback HTTP.

### Root cause kegagalan gate, dan bukti pemisahan lapisan

- Tanpa fallback, Caddy menjawab Host non-kanonis dengan 200 kosong. Ini kegagalan proxy (bukan bypass generation): request tidak pernah mencapai MaPic.
- Setelah fallback ditambahkan, harness sempat gagal dengan `write EPROTO ... tlsv1 alert internal error`. Probe terisolasi membuktikan penyebabnya ada di klien Node: `https.request` menurunkan SNI dari header Host ketika `servername` tidak di-pin (`sni="evil.example"` pada koneksi ke IP literal), sehingga handshake gagal karena Caddy tidak punya certificate untuk nama itu — bukan uji routing proxy. Koneksi dengan SNI kosong dan Host asing menerima 403, dan client independen `curl -H 'Host: evil.example'` juga menerima 403 (exit 0) dengan verifikasi CA dan hostname.
- Harness kini mem-pin SNI kosong (perilaku browser pada IP literal) dan menambahkan assertion terpisah: SNI asing harus gagal pada handshake (`rejects`, tanpa respons HTTP sama sekali). `rejectUnauthorized` tetap `true`, `checkServerIdentity` tetap memeriksa cert `127.0.0.1`, dan tidak ada assertion yang menerima 200 bebas.

### Gate Caddy nyata — lulus pada loopback (9 Oktober 2026)

| Gate | Hasil |
| --- | --- |
| `rtk proxy env PATH="<caddy-dir>:$PATH" npm run test:lan` | Exit 0 — `PASS: Caddy config, verified TLS, origin guards, private paths and mock generation`, 0,66 detik |
| Run berurutan tambahan (4x, termasuk via `node --import tsx`) | Exit 0 semua; tidak ada flake |
| Assert satu listener (`caddy adapt` config operator + fixture) | Lulus — `["<ip>:<port>"]` tunggal untuk site kanonis dan fallback |
| Assert 403 eksplisit untuk `Origin` asing, `Host` asing, `Origin` `http://` pada port HTTPS, dan `GET /` dengan `Host` asing | Lulus; frontend document tidak pernah disajikan ke Host asing |
| Assert CA tak-tepercaya dan SNI asing | Lulus — `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` dan kegagalan handshake |
| Assert path privat 404, asset statis 200 melalui TLS, satu call mock generation | Lulus |
| Tanpa Caddy pada PATH (`rtk npm run test:lan`) | Exit 1 dengan `Caddy executable required for test:lan`; fixture dibersihkan |

Versi dan integritas runtime: Node `v24.17.0` (`/Users/leekhan/.nvm/versions/node/v24.17.0/bin/node`), Caddy `v2.11.7 h1:yj0Y4fYZGPkSvibBJ1sTWE33xC0fxztVyXEW5iIdUT4=`. Binary sementara dipakai dari direktori kerja review (`/private/tmp/inkspire-caddy-tool/caddy`, SHA-256 `0d746e47f39d9706883b3633bf419feb25973e6caaa8eabbf5b44421d59e3973`); archive `caddy_2.11.7_mac_arm64.tar.gz` SHA-256 `cda3030e5d5b13eb9f0b6fb541037f633bddd958c070c5f561d7a5cccb581665` dan hasil ekstraksi byte-identik dengan binary yang dijalankan. Tidak ada instalasi global, tidak ada perubahan trust store OS, tidak ada firewall, tidak ada `.env` pengguna yang dibaca.

Harness juga memperbaiki dua kerentanan flake: pembacaan CA sekarang menunggu file muncul (sebelumnya bisa `ENOENT` karena Caddy membuat CA secara asinkron), dan guard `spawnError`/exit code digabung ke satu fungsi agar poll loop tidak balapan dengan state child.

### Negative control — 9 Oktober (working diff, dipulihkan byte-exact)

| Mutasi sementara | Hasil |
| --- | --- |
| Hapus blok fallback `https://:<port>` dari `server/lan.ts` | `test:lan` exit 1 — `invalid Host must be rejected explicitly, received 200`, tepat pada temuan review |
| `bind` fallback diganti `0.0.0.0` | `test:lan` exit 1 — `canonical site and fallback must share one LAN listener`, actual `["0.0.0.0:<port>", "<ip>:<port>"]` |
| Hapus blok fallback, jalankan unit | `tests/network-config.test.ts` gagal 1 test pada assertion `https://:8443 {` |

Setiap mutasi langsung dipulihkan; SHA-256 `server/lan.ts` dan `tests/network-caddy.ts` diverifikasi identik sebelum dan sesudah (RESTORE_EXACT), dan tidak ada hasil mutasi yang di-commit.

### Bukti runtime CLI foreground/shutdown — 9 Oktober

Sebelumnya klaim shutdown hanya bersandar pada cleanup child di harness TLS. Empat run CLI aktual kini tercatat, semuanya proses milik tes, environment eksplisit tanpa `.env` (kompanion dijalankan langsung dari `dist-server`), MaPic diarahkan ke loopback tertutup atau mock repo:

| Run | Susunan | Hasil |
| --- | --- | --- |
| 1 | `lan:serve` tanpa companion, listener LAN `192.168.2.39:18443` | `GET /` → 502 dengan `server: Caddy`; membuktikan companion harus berjalan lebih dulu (R3). SIGINT → CLI exit 0 dalam 0,5 s; 0 proses Caddy tersisa; 0 listener |
| 2 | companion (terminal 1, cwd repo agar `dist` terbaca) + `lan:serve` (terminal 2, cwd fixture terisolasi) | `GET /` → 200 document; `Host: evil.example` → 403 `server: Caddy`; path privat → 404; font → 200; SIGINT kedua proses → exit 0, listener lepas |
| 3 | sama, endpoint API | `POST /api/ai/generate` Origin asing → 403 `LOCAL_ONLY`; Host asing → 403 kosong dari Caddy; `Origin http://` → 403 `LOCAL_ONLY`; token tidak muncul di log (0 occ) |
| 4 | companion + mock MaPic repo (loopback) | `POST /api/ai/generate` origin kanonis → 200 dengan `b64_json`, satu call ke mock dengan `Authorization` Bearer, 0 kebocoran token ke client |

Seluruh run memakai port tinggi tidak baku (18443–18445) dan hanya mengirim sinyal ke PID yang dimulai run tersebut; setelah tiap run `lsof` dan `pgrep` menunjukkan 0 listener dan 0 proses Caddy. Listener LAN dibuka selama beberapa detik sesuai desain `lan:serve` yang diuji, tanpa trust OS dan tanpa MaPic nyata. Run 2 juga mengoreksi asumsi test awal: companion melayani `dist` relatif terhadap direktori kerja, sehingga `npm start` memang harus dari root repo seperti ditulis di WORKFLOW.

### Suite regresi pada state ini

`rtk npm run typecheck` exit 0; `rtk npm test` exit 0 — 119 tests, 17 files (~1,0 detik); `rtk npm run build` exit 0; `rtk npm run test:lan` exit 0 (Caddy pada PATH); `rtk npm run test:e2e` exit 0 — 46 tests, 1,6 menit; `rtk proxy env INKSPIRE_TEST_MODE=production npm run test:e2e` exit 0 — 45 lulus + 1 di-skip, 57,4 detik; `rtk git diff --check` exit 0. Unit LAN kini 8 tests di `tests/network-config.test.ts`; positive CLI test memakai klasifikasi RFC 1918 (`10/8`, `172.16/12`, `192.168/16`) dan `test.skipIf` agar tidak tercatat lulus tanpa assertion ketika tidak ada interface privat.

### Masih pending

- Sign-off perangkat nyata: belum ada device/browser yang mempercayai CA dan menguji skenario manual di tabel sebelumnya. Status ini tidak berubah pada putaran ini.
- `npm run test:lan` dan `lan:serve` tetap memerlukan executable Caddy pada PATH milik operator; suite default sengaja tidak bergantung padanya.
