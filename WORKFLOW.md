# Workflow

Panduan ini mencakup penggunaan aplikasi, development, pemeriksaan perubahan, dan persiapan repository. Desain sistem ada di [Architecture](ARCHITECTURE.md); riwayat perubahan ada di [Changelog](CHANGELOG.md).

## Setup lokal

Gunakan Node.js `24.x` dan npm. Jalankan semua perintah dari root proyek.

```sh
npm ci
npm run dev
```

Buka **http://127.0.0.1:4173**. Companion menyajikan Vite dan API pada origin yang sama. Gunakan alamat yang konsisten agar draft browser tetap berada pada storage yang sama.

Untuk menjalankan hasil build:

```sh
npm run build
npm start
```

Hentikan proses dev sebelum menjalankan production pada port yang sama. `npm start` membutuhkan `dist/` dan `dist-server/` dari build. Production tetap merupakan companion lokal yang bind ke loopback.

### Konfigurasi AI opsional

Jika `.env` belum ada, salin [.env.example](.env.example) menjadi `.env`. Pertahankan file `.env` yang sudah diisi.

| Variable | Pengisian |
| --- | --- |
| `INKSPIRE_PORT` | Port lokal, default `4173` |
| `MAPIC_BASE_URL` | URL backend MaPic HTTP/HTTPS |
| `MAPIC_SERVICE_TOKEN` | Nilai token service yang sama dengan backend MaPic aktif, tanpa prefix `Bearer` |

Token service berbeda dari JWT pengguna dan Supabase service-role key. Token hanya digunakan companion; jangan memberinya prefix `VITE_` atau memasukkannya ke kode frontend.

Script startup memuat `.env` melalui Node.js `--env-file-if-exists`. Konfigurasi dibaca sekali saat startup, relatif terhadap direktori kerja. Environment shell memiliki prioritas atas file. Setelah perubahan, hentikan companion dengan `Ctrl+C`, lalu jalankan ulang `npm run dev` atau `npm start`. Refresh browser tidak memuat ulang konfigurasi backend. Perilaku loading tersebut mengikuti [dokumentasi CLI Node.js](https://nodejs.org/docs/latest-v24.x/api/cli.html#--env-filefile).

Canvas, draft, import/save, dan export tetap dapat digunakan ketika konfigurasi AI kosong.

## Alur workspace

1. Buka aplikasi. Draft terakhir dipulihkan sebelum editor siap digunakan.
2. Beri nama workspace dan gambar menggunakan tools native Excalidraw.
3. Tunggu status **Draft tersimpan di browser** setelah perubahan.
4. Pilih **Simpan file** untuk mendapatkan snapshot `.excalidraw` dengan gambar tertanam.
5. Gunakan **Export** untuk PNG/SVG seluruh scene atau seleksi.

Autosave memperbarui draft browser. File unduhan merupakan snapshot saat tombol simpan ditekan dan tidak diperbarui otomatis. Gunakan **Simpan file** kembali untuk membuat cadangan perubahan terbaru.

**Canvas baru** atau **Buka file** meminta pilihan simpan dahulu, ganti, atau batal. Memilih simpan dahulu mengunduh salinan dan mempertahankan canvas; jalankan kembali tindakan penggantian setelah cadangan dibuat. Import yang gagal mempertahankan workspace aktif. Drag-and-drop file workspace memakai guard yang sama.

| Shortcut | Tindakan |
| --- | --- |
| `Ctrl/Cmd+S` | Simpan file workspace |
| `Ctrl/Cmd+O` | Buka file melalui alur konfirmasi |
| `Ctrl/Cmd+Backspace/Delete` | Canvas baru melalui konfirmasi |

Tema mengikuti OS secara default. Klik ikon Ink kiri header untuk mengganti Light/Dark, atau centang **Ikuti sistem** di footer. Pilihan **Bahasa** menyediakan Indonesia dan English. Keduanya tersimpan lokal dan mempertahankan scene, undo, serta input AI.

## Alur AI Image

1. Buka **AI image** di header.
2. Isi prompt nonempty, maksimal 2000 Unicode code points.
3. Opsional: upload PNG/JPEG atau pilih objek canvas lalu gunakan **Dari seleksi canvas**. Maksimal 10 referensi; aplikasi menyiapkan salinan sesuai batas layanan.
4. Opsional: atur **Lanjutan**. Default 40 steps, CFG 1, resolusi 1024. CFG di atas 1 membutuhkan negative prompt untuk guidance.
5. Klik **Generate image**. Prompt dan referensi dikirim ke MaPic melalui companion.
6. Tunggu hasil. Canvas tetap dapat dipakai dan panel dapat ditutup tanpa membatalkan request.
7. Pilih **Tambahkan ke canvas** atau **Unduh PNG** setelah preview muncul.

Gambar pada canvas dapat di-undo, ikut autosave, dan masuk file workspace. Jika workspace sudah berubah sejak generation dimulai, insertion meminta konfirmasi target.

Preview, prompt, dan referensi AI hanya berada dalam memori halaman. Tambahkan atau unduh hasil sebelum reload, menutup halaman, atau mengganti preview. Belum ada galeri hasil generation. Jalur service MaPic tidak membuat history atau upload Supabase untuk request ini.

### Arti lokasi penyimpanan

| Pilihan | Hasil |
| --- | --- |
| Preview saja | Sementara di memori halaman |
| Tambahkan ke canvas | Gambar menjadi bagian draft IndexedDB |
| Unduh PNG | File gambar di lokasi unduhan pengguna |
| Simpan file | File `.excalidraw` editable dengan gambar |
| Export PNG/SVG | Gambar scene atau seleksi canvas |

Penyimpanan terpisah berdasarkan profil browser dan origin, bukan akun. Menghapus data browser, mode privat, pergantian browser/alamat, atau kuota storage dapat memengaruhi draft. File unduhan menyediakan cadangan terpisah.

## Development dan verifikasi

Ubah kode sesuai area: editor di `src/features/editor`, persistence/file di `src/features/workspace`, AI di `src/features/ai`, dan transport/validasi backend di `server`.

Untuk perubahan perilaku, jalankan pemeriksaan terarah pada area yang diubah. Sebelum menyiapkan versi baru, jalankan gate lengkap:

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
INKSPIRE_TEST_MODE=production npm run test:e2e
```

Perintah environment terakhir memakai sintaks POSIX shell. Pada PowerShell, gunakan:

```powershell
$env:INKSPIRE_TEST_MODE = 'production'
npm run test:e2e
Remove-Item Env:INKSPIRE_TEST_MODE
```

Instalasi Chromium diperlukan pada setup pertama atau ketika versi browser Playwright berubah; lihat [panduan browser Playwright](https://playwright.dev/docs/browsers#install-browsers).

| Gate | Yang diperiksa |
| --- | --- |
| Typecheck | Client, companion, dan tests |
| Unit/HTTP | Draft/autosave, schema, gambar, request, security, transport |
| Build | Aset lokal, bundle frontend, companion compiled |
| E2E dev | Workflow browser dengan companion development |
| E2E production | Workflow browser dengan entry compiled dan `dist` |

Harness memakai port `4183` untuk app dan `4184` untuk mock. Port yang sedang digunakan menyebabkan kegagalan; `reuseExistingServer` dimatikan. Tes tidak memakai server dev pengguna, `.env` operator, atau GPU nyata. Jalankan build sebelum E2E production.

Screenshot, trace, dan log lokal berada di `output/` serta direktori laporan tes yang dikecualikan dari Git. [Verifikasi](docs/verification.md) mencatat hasil pemeriksaan historis; hasil tersebut bukan pengganti menjalankan gate untuk perubahan baru.

Untuk tes MaPic nyata, gunakan app dengan konfigurasi backend sendiri dan lakukan generation secara eksplisit. HTTP200 health/status ready hanya membuktikan kesiapan model; autentikasi service dan hasil generation perlu diperiksa terpisah. Hindari retry ketika timeout/disconnect membuat hasil belum diketahui, karena job GPU sebelumnya dapat tetap berjalan.

## Troubleshooting

| Gejala | Pemeriksaan dan tindakan |
| --- | --- |
| `SERVICE_UNCONFIGURED` | Isi kedua variable MaPic dalam `.env` root, periksa override environment shell, lalu restart companion |
| `MAPIC_401` / pesan autentikasi | Samakan token lokal dengan `MAPIC_SERVICE_TOKEN` backend MaPic yang benar-benar aktif; gunakan nilai tanpa prefix `Bearer`, lalu restart companion |
| `MAPIC_503` | Service MaPic belum diaktifkan atau layanan tidak tersedia; periksa konfigurasi operator MaPic |
| `REQUEST_ACTIVE` | Companion masih memiliki request aktif; tunggu hasil/deadline sebelum percobaan baru |
| HTTP429 | Antrean MaPic penuh; coba manual setelah layanan tersedia |
| Timeout/koneksi terputus, hasil belum diketahui | Periksa layanan; generation mungkin masih berjalan. Jangan langsung mengirim ulang |
| Draft tampak hilang | Pastikan profil browser serta scheme/hostname/port sama; buka cadangan `.excalidraw` bila tersedia |
| Draft gagal dibaca/ditulis | Ikuti recovery atau Simpan file; jangan menghapus data browser sebelum membuat cadangan yang bisa disimpan |
| Port 4173 sedang dipakai | Hentikan companion yang Anda jalankan sebelumnya, atau pilih port lain dengan konsekuensi storage origin berbeda |
| E2E tidak mulai | Pastikan 4183/4184 bebas, Chromium terinstal, dan build tersedia untuk mode production |

Untuk MaPic berbasis Docker, perubahan token pada file environment server perlu diterapkan dengan recreate backend sesuai panduan deployment MaPic; restart container saja tidak memuat ulang `env_file`. Setelah itu samakan konfigurasi Inkspire. Operasi server tersebut berada di proyek MaPic.

## Persiapan repository GitHub

Repository tujuan adalah [LyKhan77/Inkspire](https://github.com/LyKhan77/Inkspire), dengan remote Git `https://github.com/LyKhan77/Inkspire.git`. Aturan kontributor dan coding agent tersedia di [AGENTS.md](AGENTS.md).

Dokumentasi utama adalah [README](README.md), [Architecture](ARCHITECTURE.md), dokumen ini, [Changelog](CHANGELOG.md), [kontrak MaPic](docs/mapic-contract.md), dan [Third-party notices](THIRD_PARTY_NOTICES.md).

- Sertakan source, tests, konfigurasi, scripts, `package.json`, `package-lock.json`, dokumentasi, dan aset/font/notice publik yang dibutuhkan aplikasi.
- Pertahankan `.env.example` dengan nilai MaPic kosong. [.gitignore](.gitignore) mengecualikan `.env`, dependency/build, `temp/`, state tooling, serta artefak tes lokal.
- Plan tidak boleh di-commit. `docs/plans/` dan `docs/superpowers/plans/` dikecualikan dari Git; simpan spesifikasi baru di `docs/superpowers/specs/`. Pertahankan catatan historis yang sudah ada tanpa membuat duplikat.
- Jangan memasukkan token, URL operator yang bersifat privat, log sensitif, atau file workspace pribadi ke repository. Jika suatu file sudah pernah tracked, penambahan rule ignore saja tidak menghapusnya dari tracking/history.
- Artefak di `output/` diabaikan Git dan dapat dibersihkan setelah pemeriksaan. Dokumen verifikasi mempertahankan catatan hasil historis; untuk evidence di GitHub, lampirkan artefak yang sudah diperiksa secara terpisah.
- Pertahankan [LICENSE](LICENSE) Apache-2.0 dan [Third-party notices](THIRD_PARTY_NOTICES.md). Komponen pihak ketiga mengikuti lisensinya masing-masing.
- Catat perubahan berikutnya pada bagian **Unreleased** di changelog. Saat membuat release, pindahkan perubahan tersebut ke heading versi dan tanggal yang benar, serta sinkronkan versi package/lock.

CI GitHub belum ditetapkan oleh panduan ini. Jalankan gate lokal dan tinjau isi file yang akan dikirim sebelum push.
