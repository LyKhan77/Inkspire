# Changelog

Perubahan penting Inkspire dicatat di sini. Versi package saat ini `0.1.0`; perubahan setelah implementasi awal berada di **Unreleased** sampai versi berikutnya ditetapkan. Tanggal mencatat pekerjaan yang dilakukan, tanpa mengasumsikan tag atau release GitHub sudah diterbitkan.

## Unreleased

### Added

- Header README dengan banner SVG editorial, wordmark Space Grotesk berbentuk path, serta ikon Ink animasi mandiri. Loop tetes/ripple memiliki jeda; elemen picture memilih banner statis untuk reduced motion. Warna mengikuti light/dark browser tanpa font atau resource eksternal.
- Pilihan Indonesia/English di footer, tersimpan lokal. Shell, label editor, dialog, status, dan pesan error berganti tanpa mereset canvas, aset, nama workspace, prompt, atau undo.
- Outline persisten pada pilihan properti teks/guratan aktif, termasuk font, ukuran, perataan, warna, dan stroke; mendukung light/dark.
- Tema **tinta mengembang** dari ikon Ink kiri header: View Transition organik 650 ms dan animasi tetes, keyboard, guard klik cepat, serta cleanup interupsi. Reduced motion dan browser tanpa API memakai pergantian langsung.
- Kontrol **Ikuti sistem** di footer untuk memulihkan tema OS setelah pilihan manual.
- Preview alternatif animasi SVG/CSS di `/previews/ink-theme.html`.
- [Architecture](ARCHITECTURE.md) dan [Workflow](WORKFLOW.md): struktur sistem, ownership state, persistence, lifecycle AI, setup, pengujian, troubleshooting, dan persiapan repository.
- [AGENTS.md](AGENTS.md): konteks proyek, commands, conventions, workflow, current state, dan aturan kontribusi owner, dokumentasi, branch, serta plan yang tidak di-commit.

### Changed

- Kontrol tema footer sebelumnya diganti dengan interaksi ikon Ink dan pilihan mengikuti sistem.
- Petunjuk konfigurasi MaPic menjelaskan pemuatan `.env` saat startup, token service, restart companion, dan perbedaan draft/preview/file lokal.
- Dokumentasi verifikasi mencatat cakupan mock dan T2I MaPic nyata secara terpisah.
- Remote repository GitHub dicatat pada panduan proyek; direktori plan lama dan `docs/superpowers/plans/` dikecualikan dalam `.gitignore`.
- Lisensi source Inkspire ditetapkan menjadi Apache-2.0 sesuai pilihan pengguna, dengan teks LICENSE resmi dan metadata package yang konsisten.
- Artefak tes/preview sementara, log, screenshot, dan unduhan uji dibersihkan; isi `temp/` dipertahankan. Dokumentasi verifikasi mempertahankan hasil historis tanpa tautan ke artefak yang telah dihapus.

### Fixed

- Hover swatch mempertahankan warna elemen; outline mengikuti filter warna native pada dark mode.
- Konfigurasi lingkungan lokal yang menyebabkan `SERVICE_UNCONFIGURED` diperbaiki dengan reload companion setelah perubahan `.env`.
- Ketidaksesuaian token lokal dengan token runtime MaPic yang menyebabkan HTTP401 diperbaiki dengan menyamakan konfigurasi backend dan restart companion. Ini perbaikan konfigurasi operator, bukan perubahan autentikasi source.

### Verified — 2026-10-08

- Setelah integrasi tema/bahasa: typecheck dan build lulus; 41 tes unit/HTTP serta 29 E2E pada masing-masing mode dev dan compiled production lulus.
- Satu T2I nyata dari UI berhasil HTTP200, 40 steps/CFG1/resolusi1024, dalam 34,611 detik. Preview dan unduhan PNG1024×1024 berhasil; hasil lolos validasi decode penuh. I2I tetap memiliki verifikasi mock.
- Evidence lengkap serta keterbatasan pemeriksaan tersedia di [verifikasi](docs/verification.md). Gate sebelum initial push dijalankan kembali: typecheck/build, 41 tes unit/HTTP, 29 E2E dev dan 29 E2E compiled production lulus.

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
