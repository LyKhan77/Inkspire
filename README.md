# Inkspire

Canvas pribadi, diagram native Excalidraw, dan gambar AI melalui MaPic. Workspace disimpan lokal; aplikasi langsung membuka canvas tanpa akun.

Repository: [LyKhan77/Inkspire](https://github.com/LyKhan77/Inkspire).

Dokumentasi: [Architecture](ARCHITECTURE.md), [Workflow](WORKFLOW.md), [Changelog](CHANGELOG.md), [panduan kontributor/agent](AGENTS.md), dan [kontrak MaPic](docs/mapic-contract.md).

## Menjalankan

Gunakan Node **24.x**. Jalankan dari direktori proyek:

```sh
npm ci
npm run build
npm start
```

Buka **http://127.0.0.1:4173**. Companion hanya menerima koneksi loopback. Gunakan alamat ini secara konsisten: IndexedDB berbeda untuk setiap origin, termasuk port dan hostname berbeda.

Pengembangan memakai companion yang sama:

```sh
npm run dev
```

Vite berjalan sebagai middleware pada companion, sehingga canvas, draft, dan API berada pada satu origin. Jangan memakai server Vite terpisah untuk workspace normal.

## Konfigurasi MaPic

Canvas, draft, file, dan export dapat dipakai tanpa konfigurasi MaPic. Untuk mengaktifkan generation, salin `.env.example` menjadi `.env` lalu isi konfigurasi backend sendiri:

| Variable | Kegunaan |
| --- | --- |
| `INKSPIRE_PORT` | Port lokal, default `4173` |
| `MAPIC_BASE_URL` | URL backend MaPic HTTP/HTTPS |
| `MAPIC_SERVICE_TOKEN` | Kredensial mesin MaPic |

Setelah `.env` diisi atau diubah, hentikan dev dengan `Ctrl+C` lalu jalankan `npm run dev` kembali. Companion membaca konfigurasi saat startup; refresh browser saja tidak memuat nilai baru. `MAPIC_BASE_URL` menunjuk backend MaPic, bukan URL frontend. Token berupa nilai service token, tanpa prefix `Bearer`.

`.env` dikecualikan dari Git. Token hanya dibaca companion. Jangan memakai prefix `VITE_`, memasukkan token ke browser, atau membawanya dalam workspace. HTTP LAN tidak mengenkripsi Bearer; gunakan HTTPS atau transport terlindungi pada jaringan yang tidak dipercaya.

## Workspace dan file

- **Draft tersimpan di browser** berarti transaksi IndexedDB selesai. Satu draft aktif dipulihkan saat aplikasi dibuka kembali. Draft lama tetap dipertahankan jika read/write gagal; halaman menyediakan tindakan pemulihan atau Simpan file.
- **Simpan file** mengunduh `.excalidraw` yang editable dan membawa aset gambar. Autosave tidak memperbarui file unduhan. Simpan file secara berkala sebagai backup.
- **Canvas baru / Buka file** meminta pilihan Simpan file dahulu, Ganti canvas, atau Batal. Simpan file dahulu mengunduh salinan dan mempertahankan canvas. Import yang gagal mempertahankan workspace aktif.
- **Export PNG/SVG** menghasilkan gambar dari scene atau seleksi. File ini berbeda dari workspace editable.
- Menghapus data browser, memakai mode privat, mengganti browser/origin, atau batas kuota storage dapat menghilangkan akses draft. File unduhan menyediakan salinan yang dapat dipindahkan.

Shortcut `Ctrl/Cmd+S` menyimpan file, `Ctrl/Cmd+O` membuka file, dan `Ctrl/Cmd+Backspace/Delete` melalui konfirmasi penggantian. Shortcut command palette membuka menu Workspace Inkspire agar tindakan file/clear memakai guard yang sama. Drawing, seleksi, zoom, pan, konektor, dan undo/redo tetap native Excalidraw.

Tema mengikuti sistem secara default. **Klik ikon Ink kiri header** untuk berganti Light/Dark dengan animasi tinta mengembang 650 ms. Override disimpan lokal. Centang **Ikuti sistem** di footer untuk memakai preferensi OS kembali. Tema shell tidak mengubah warna elemen atau PNG scene; scene, aset, undo, dan request AI tetap berjalan. Keyboard Enter/Space didukung. Reduced motion atau browser tanpa View Transition API mengganti tema langsung.

Pilihan **Bahasa** di footer menyediakan Indonesia dan English, termasuk label editor native, dialog, status, dan pesan error aplikasi. Preferensi disimpan lokal. Mengganti bahasa mempertahankan canvas, undo, nama workspace, dan input AI. Pilihan properti aktif memiliki outline yang tetap terlihat di light/dark; hover swatch mempertahankan warna aslinya.

Preview perbandingan tema tinta tetap tersedia di **http://127.0.0.1:4173/previews/ink-theme.html**. Pengguna memilih **A — tinta mengembang**, yang sudah dipasang pada header aplikasi. B/C tetap berupa alternatif prototype.

## AI image

Panel kanan tertutup saat startup. Prompt wajib diisi, maksimum **2000 Unicode code points**. Tambahkan sampai **10 PNG/JPEG** dari file atau snapshot seleksi. Preprocessing membuat salinan referensi; aset sumber canvas tetap utuh.

Default: resolusi **1024**, **40 steps**, **CFG 1**. Lanjutan menyediakan steps 20–75, CFG 1–3, dan negative prompt. CFG di atas 1 membutuhkan negative prompt untuk guidance.

Hasil muncul sebagai preview. **Tambahkan ke canvas** membuat gambar native yang bisa di-undo, ikut draft, dan masuk file workspace. Jika workspace berubah, penambahan meminta konfirmasi target. **Unduh PNG** menyimpan gambar hasil secara terpisah.

Canvas dapat diedit, disimpan, dan diexport selama menunggu. Menutup panel mempertahankan form/request. Tidak ada retry otomatis, progress persen, cancel GPU, gallery, atau pemulihan hasil lintas reload. Preview yang belum ditambahkan tidak masuk file scene. Reload/disconnect tidak membatalkan GPU; hasil ambigu membutuhkan konfirmasi sebelum percobaan baru karena ada risiko job ganda. Browser dapat memberi peringatan sebelum keluar, tetapi tidak menjamin recovery setelah crash.

Kontrak lengkap: [docs/mapic-contract.md](docs/mapic-contract.md).

## Pemeriksaan lokal

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
INKSPIRE_TEST_MODE=production npm run test:e2e
```

Harness memakai companion `4183`, mock MaPic `4184`, dan token sentinel khusus tes. Port yang terpakai menyebabkan kegagalan; server pengguna tidak dipakai ulang. Tes tidak membaca `.env` operator dan tidak memiliki fallback ke GPU nyata. Production smoke menjalankan entry hasil compilation dengan environment tes eksplisit.

Browser yang diuji: Chromium Playwright, viewport 1280×800, 1440×1000, dan 390×844, light/dark. Tes menghasilkan artefak lokal di `output/playwright/`; artefak historis telah dibersihkan dan tidak disertakan dalam repository. Suite otomatis memakai mock. T2I MaPic nyata juga berhasil pada 8 Oktober 2026: HTTP200, PNG1024×1024, 40 steps/CFG1, 34,611 detik; I2I tetap diverifikasi melalui mock.

Hasil gate, matrix kriteria, dan artifact: [docs/verification.md](docs/verification.md).

## Lisensi dan batas MVP

Source Inkspire berlisensi [Apache-2.0](LICENSE). Notice dependency/font: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), teks font di `public/fonts/` dan `public/excalidraw/licenses/`. Font UI serta font editor disajikan lokal. Komponen pihak ketiga tetap mengikuti lisensinya masing-masing.

MVP untuk individu, local-first. MCP adalah tahap berikutnya. Build membawa engine Excalidraw beserta chunk native yang cukup besar; tidak ada klaim ukuran bundle minimal atau browser lain sudah diuji.
