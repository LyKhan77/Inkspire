# Changelog

Perubahan penting Inkspire dicatat di sini. Versi package saat ini `0.1.0`; perubahan setelah implementasi awal berada di **Unreleased** sampai versi berikutnya ditetapkan. Tanggal mencatat pekerjaan yang dilakukan, tanpa mengasumsikan tag atau release GitHub sudah diterbitkan.

## Unreleased

### Added

- **Flowchart lokal tanpa AI** di More Tools: langkah/kondisi terstruktur atau subset Mermaid → `FlowGraph` bounded → Mermaid kanonik → converter lokal → preview → elemen native editable. Mendukung keyword Indonesia/English, cabang dua spasi, merge label identik, `@label` untuk referensi maju/loop, arah TD/LR, batas 8.000 karakter / 200 baris / 50 node / 100 konektor / label 120 karakter / 350 elemen, error bernomor baris, dan warning struktur nonblocking. Bekerja tanpa `.env` atau MaPic.
- Insertion aditif memakai API native editor: ID dan binding baru, satu group per diagram, posisi pusat viewport, satu langkah undo, tanpa reset scene/history atau mengubah diagram dan aset lama. Sumber disimpan sebagai snapshot `customData.inkspireFlowchart` pada satu anchor dan ikut draft/file `.excalidraw`.
- Dialog modal dengan tab Teks/Mermaid, arah, contoh, preview, daftar warning, salin kode dengan fallback seleksi manual, keyboard tab/fokus/Escape, light/dark, Indonesia/English, dan layout satu kolom di mobile.
- Adapter editor mengalihkan kedua jalur native (`ttd/text-to-diagram` dan `ttd/mermaid`) ke validator yang sama, sehingga entri Mermaid bawaan tidak lagi menjadi jalur bypass. Badge AI tetap pada item Flowchart disembunyikan lewat selector CSS yang diskop pada marker entry tersebut; tidak ada patch vendor atau manipulasi DOM.
- `useWorkspace` mengekspos `workspaceId` reaktif sebagai mirror observable identitas, sehingga penggantian file bernama sama tetap menginvalidasi preview.
- Spec MVP Flowchart pada `docs/superpowers/specs/2026-10-08-flowchart-design.md`.
- Header README dengan banner SVG editorial, wordmark Space Grotesk berbentuk path, serta ikon Ink animasi mandiri. Loop tetes/ripple memiliki jeda; elemen picture memilih banner statis untuk reduced motion. Warna mengikuti light/dark browser tanpa font atau resource eksternal.
- Pilihan Indonesia/English di footer, tersimpan lokal. Shell, label editor, dialog, status, dan pesan error berganti tanpa mereset canvas, aset, nama workspace, prompt, atau undo.
- Outline persisten pada pilihan properti teks/guratan aktif, termasuk font, ukuran, perataan, warna, dan stroke; mendukung light/dark.
- Tema **tinta mengembang** dari ikon Ink kiri header: View Transition organik 650 ms dan animasi tetes, keyboard, guard klik cepat, serta cleanup interupsi. Reduced motion dan browser tanpa API memakai pergantian langsung.
- Kontrol **Ikuti sistem** di footer untuk memulihkan tema OS setelah pilihan manual.
- Preview alternatif animasi SVG/CSS di `/previews/ink-theme.html`.
- [Architecture](ARCHITECTURE.md) dan [Workflow](WORKFLOW.md): struktur sistem, ownership state, persistence, lifecycle AI, setup, pengujian, troubleshooting, dan persiapan repository.
- [AGENTS.md](AGENTS.md): konteks proyek, commands, conventions, workflow, current state, dan aturan kontribusi owner, dokumentasi, branch, serta plan yang tidak di-commit.

### Changed

- `@excalidraw/mermaid-to-excalidraw` 2.2.2 dan `mermaid` 11.17.2 dinyatakan sebagai dependency langsung dengan pin persis seperti versi transitif yang sudah terpasang; Excalidraw tetap 0.18.1 dan tidak ada dependency lain yang naik versi.
- Kontrol tema footer sebelumnya diganti dengan interaksi ikon Ink dan pilihan mengikuti sistem.
- Petunjuk konfigurasi MaPic menjelaskan pemuatan `.env` saat startup, token service, restart companion, dan perbedaan draft/preview/file lokal.
- Dokumentasi verifikasi mencatat cakupan mock dan T2I MaPic nyata secara terpisah.
- Remote repository GitHub dicatat pada panduan proyek; direktori plan lama dan `docs/superpowers/plans/` dikecualikan dalam `.gitignore`.
- Lisensi source Inkspire ditetapkan menjadi Apache-2.0 sesuai pilihan pengguna, dengan teks LICENSE resmi dan metadata package yang konsisten.
- Artefak tes/preview sementara, log, screenshot, dan unduhan uji dibersihkan; isi `temp/` dipertahankan. Dokumentasi verifikasi mempertahankan hasil historis tanpa tautan ke artefak yang telah dihapus.

### Fixed

- Flowchart: arrow yang dihasilkan converter Mermaid bisa masuk canvas dengan `points[0]` bukan `[0, 0]`, sehingga Excalidraw mencatat `Linear element is not normalized` saat konektor dibuka di editor garis. Hasil conversion dinormalisasi (origin digeser, `x`/`y` dan `width`/`height` dihitung ulang) sebelum preview maupun insertion, dan boundary output kini menolak panah yang belum ternormalisasi alih-alih mengirimnya ke scene.
- Flowchart: token Mermaid dengan dua deklarasi bentuk pada satu baris (`A["One"] B["Two"]`) diterima diam-diam sebagai satu node berlabel cacat. Wrapper bentuk sekarang harus cocok dengan seluruh token, kutip hanya boleh membungkus seluruh isi, dan token campuran ditolak `MERMAID_SYNTAX` dengan nomor baris; label berkurung siku di dalam kutip tetap diterima.
- Hover swatch mempertahankan warna elemen; outline mengikuti filter warna native pada dark mode.
- Konfigurasi lingkungan lokal yang menyebabkan `SERVICE_UNCONFIGURED` diperbaiki dengan reload companion setelah perubahan `.env`.
- Ketidaksesuaian token lokal dengan token runtime MaPic yang menyebabkan HTTP401 diperbaiki dengan menyamakan konfigurasi backend dan restart companion. Ini perbaikan konfigurasi operator, bukan perubahan autentikasi source.

### Verified — 2026-10-08

- Setelah integrasi tema/bahasa: typecheck dan build lulus; 41 tes unit/HTTP serta 29 E2E pada masing-masing mode dev dan compiled production lulus.
- Satu T2I nyata dari UI berhasil HTTP200, 40 steps/CFG1/resolusi1024, dalam 34,611 detik. Preview dan unduhan PNG1024×1024 berhasil; hasil lolos validasi decode penuh. I2I tetap memiliki verifikasi mock.
- Evidence lengkap serta keterbatasan pemeriksaan tersedia di [verifikasi](docs/verification.md). Gate sebelum initial push dijalankan kembali: typecheck/build, 41 tes unit/HTTP, 29 E2E dev dan 29 E2E compiled production lulus.

### Verified — 2026-10-08 (Flowchart lokal)

- Gate fresh pada branch `feat/flowchart`: typecheck exit 0; 90 tes unit/HTTP pada 14 files (1,07 detik); build exit 0; 45 E2E development lulus (1,5 menit); 44 E2E compiled production lulus dengan 1 skip khusus dev (56,9 detik).
- Bukti browser mencakup preview tanpa mutasi canvas, insertion bergrup dengan binding tertutup dan satu undo, dua insertion tanpa collision, edit native yang mempertahankan konektor, aset gambar lama utuh, guard workspace bernama sama dan hasil async basi, revoke object URL, serta nol request non-loopback dan nol `/api/*` pada alur Flowchart.
- Review visual screenshot light, dark, mobile 390 px, dan dropdown More Tools dilakukan manual; entri Flowchart tidak menampilkan badge AI. Detail pada [verifikasi](docs/verification.md).

### Verified — 2026-10-08 (Perbaikan review Flowchart)

- Gate fresh setelah perbaikan F1/F2 pada HEAD branch `feat/flowchart`: typecheck exit 0; 103 tes unit/HTTP pada 14 files (966 ms); build exit 0 (1,48 detik); 46 E2E development lulus (1,5 menit); 45 E2E compiled production lulus dengan 1 skip yang hanya membentuk penundaan impor modul dev (57,0 detik).
- Hasil async yang masih pending kini dibuktikan pada **kedua mode** dengan menahan callback `canvas.toBlob` lalu melepasnya setelah closing dan penggantian workspace; klaim coverage pada dokumentasi dikoreksi mengikuti itu.
- Preservasi geometri diukur per tahap: mutation, reload draft, dan import file `.excalidraw` dituntut delta 0 pada seluruh field persistent; hanya replay undo→redo yang diberi batas 4 px khusus geometry panah, dengan angka terukur dicatat. Drag vertex lewat **Edit arrow** dan penolakan token Mermaid cacat kini punya regression sendiri.

### Fixed — 2026-10-08 (Review Flowchart putaran 2)

- Regression hasil async basi kini menunggu controller selesai sebelum assertion negatif: `tests/flowchart-security.e2e.ts` menunggu tombol **Buat preview** kembali enabled setelah ekspor kanvas dilepas. Sebelumnya kedua assertion sudah benar selama `busy` masih aktif, sehingga tes bisa selesai sebelum hasil converter diterima.
- Sinyal antrean hold yang kosong tidak dipakai sebagai pengganti; itu hanya membuktikan callback sudah dijadwalkan, bukan controller selesai. Tidak ada perubahan source aplikasi pada putaran ini.
- Batas toleransi `redo` pada dokumentasi ditulis ulang sebagai fakta terukur (delta `arrow.width` 3,002894287382631 px pada siklus pertama, tanpa delta tambahan di atas `1e-9` pada siklus kedua dan ketiga, Keenam panah tetap `points[0] === [0, 0]`), bukan klaim bahwa penyesuaian mustahil dihilangkan dari sisi aplikasi.

## 0.1.0 — 2026-10-07

### Added

- Canvas native Excalidraw dengan shell tinta/neobrutalism, tema sistem/manual, font lokal, dan panel AI collapsible.
- Draft IndexedDB atomik dan autosave serial; restore mendahului perubahan editor. Kegagalan read/write mempertahankan record terakhir dan menyediakan pemulihan eksplisit.
- File `.excalidraw` editable beraset, konfirmasi new/import/shortcut/drop, serta export PNG/SVG penuh atau seleksi.
- Companion loopback satu origin, validasi akses/body/field/gambar, sanitasi error, dan guard satu request aktif termasuk saat browser disconnect.
- Integrasi MaPic T2I/I2I: preprocessing referensi, preview sebelum insertion, rasio PNG, undo/redo, guard identitas workspace, dan unduh PNG. Verifikasi implementasi awal menggunakan mock.
- Font UI/editor lokal, worker font native terpisah, dan notice dependency/font.
- Harness unit/HTTP dan E2E dev/compiled production dengan mock terisolasi dari environment operator serta GPU nyata.

### Fixed

- Worker font native tidak mengimpor entry UI yang membutuhkan `document`, sehingga export teks offline dapat memakai aset lokal.
- Kontras tool aktif dan posisi tombol tutup drawer saat scroll diperbaiki setelah pemeriksaan visual.

### Verified

- Gate awal: typecheck/build lulus, 41 tes unit/HTTP, 20 E2E dev, dan 20 E2E compiled production lulus.
- Audit dependency instalasi pada saat pemeriksaan mencatat 0 temuan; credential sentinel tidak ditemukan dalam build atau workspace fixture.
- Tidak ada generation GPU nyata pada tahap implementasi awal. Status verifikasi terbaru dicatat pada bagian Unreleased dan [verifikasi](docs/verification.md).
