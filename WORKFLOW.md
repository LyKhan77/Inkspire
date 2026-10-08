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
| `INKSPIRE_PUBLIC_ORIGIN` | Opsional, HTTPS LAN production seperti `https://192.168.1.20:8443`; kosong berarti localhost |
| `MAPIC_BASE_URL` | URL backend MaPic HTTP/HTTPS |
| `MAPIC_SERVICE_TOKEN` | Nilai token service yang sama dengan backend MaPic aktif, tanpa prefix `Bearer` |

Token service berbeda dari JWT pengguna dan Supabase service-role key. Token hanya digunakan companion; jangan memberinya prefix `VITE_` atau memasukkannya ke kode frontend.

Script startup memuat `.env` melalui Node.js `--env-file-if-exists`. Konfigurasi dibaca sekali saat startup, relatif terhadap direktori kerja. Environment shell memiliki prioritas atas file. Setelah perubahan, hentikan companion dengan `Ctrl+C`, lalu jalankan ulang `npm run dev` atau `npm start`. Refresh browser tidak memuat ulang konfigurasi backend. Perilaku loading tersebut mengikuti [dokumentasi CLI Node.js](https://nodejs.org/docs/latest-v24.x/api/cli.html#--env-filefile).

Canvas, draft, import/save, dan export tetap dapat digunakan ketika konfigurasi AI kosong.

### Akses LAN opsional

Untuk device lain pada LAN yang sama, isi `INKSPIRE_PUBLIC_ORIGIN` dengan HTTPS dan IPv4 privat host, lalu jalankan dua proses production:

```sh
npm run build
npm run lan:config   # menulis Caddyfile dari konfigurasi yang sama
npm run lan:serve    # menjalankan caddy run di foreground
```

Origin LAN hanya berlaku untuk mode production dan selalu memerlukan CA internal Caddy yang dipasang manual pada device. Detail setup, trust, storage per origin, troubleshooting, dan rollback ada di [panduan LAN HTTPS](docs/network-access.md).

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

## Alur Flowchart

1. Buka **More Tools** (ikon tiga titik di toolbar editor) lalu pilih **Flowchart**. Entri ini tidak memakai AI, API key, atau konfigurasi MaPic.
2. Pada tab **Teks langkah**, tulis satu langkah per baris. **Muat contoh** mengisi contoh Indonesia.
3. Pilih **Arah flowchart** (Atas ke bawah atau Kiri ke kanan), lalu klik **Buat preview**.
4. Periksa preview dan warning struktur. Klik **Tambahkan ke canvas** untuk menyisipkan sebagai elemen native; canvas tidak berubah sebelum tombol ini ditekan.

```text
Mulai
Terima request
Jika input valid?:
  Ya -> Simpan data -> Selesai
  Tidak -> Tampilkan error -> Selesai
```

```text
Start -> Receive request
If input valid?:
  Yes -> Save data -> End
  No -> Show error -> End
```

### Grammar tab Teks

| Aturan | Perilaku |
| --- | --- |
| `->` atau `→` | Menyusun urutan langkah dalam satu baris |
| Baris langkah berurutan | Tersambung otomatis sampai kondisi pertama |
| `Jika <kondisi>:` / `If <condition>:` | Menjadi decision; tanda tanya opsional, keyword dan titik dua wajib |
| Dua spasi + `Ya`/`Yes`/`Tidak`/`No` | Cabang; tepat satu Ya dan satu Tidak per kondisi |
| Tab atau indentasi lebih dari dua spasi | Ditolak dengan nomor baris |
| Nested indentation | Di luar scope MVP |
| Label identik | Node yang sama; perbandingan case-sensitive setelah NFC, trim, dan pemadatan spasi |
| `@label` | Referensi node lain, hanya sebagai token terakhir; target harus didefinisikan di bagian mana pun |
| `Mulai`/`Start`/`Selesai`/`End` | Terminal. Label terminal Indonesia dan English tidak otomatis digabung |

Dua proses berbeda harus memakai label berbeda. Separator, newline, dan prefix `@` tidak tersedia sebagai label literal. Blok setelah kondisi memulai rantai sendiri, jadi merge eksplisit memakai label yang sama atau `@label`.

### Subset Mermaid

Tab **Mermaid** menerima subset yang hasilnya sama dengan tab Teks; kode kanonik dari preview dapat disalin ke sana lewat **Gunakan kode Mermaid**. Tidak ada konversi Mermaid kembali ke teks.

| Bentuk | Sintaks |
| --- | --- |
| Header | `flowchart TD`, `flowchart LR`, `graph TD`, `graph LR`; `TB` dinormalisasi ke `TD` |
| Proses | `A["Label"]`, `A[Label]` |
| Decision | `B{"Kondisi?"}`, `B{Kondisi?}` |
| Terminal | `C(["Selesai"])`, `C([Selesai])`, `C("Selesai")`, `C(Selesai)` |
| Edge | `A --> B`, `A -->\|Ya\| B` |

ID harus huruf ASCII diikuti huruf/angka/underscore. Satu token hanya boleh membawa satu deklarasi bentuk: wrapper harus membungkus seluruh isi token, sehingga tulisan seperti `A["One"] B["Two"]` atau `A[One}]` ditolak dengan nomor baris alih-alih dibaca sebagai satu label. Semua referensi wajib punya definisi dan definisi ulang dengan label/bentuk berbeda ditolak. Yang ditolak dengan alasan: komentar, `;` antar statement, subgraph, `style`/`class`, `click`/`link`/callback, frontmatter, direktif `%%{init}%%`, label HTML/markdown, image/icon, bentuk `@{...}`, dan tipe diagram selain flowchart. Entity desimal dan `#quot;` dikenali pada label lalu ditulis ulang secara aman.

### Pesan dan batas

| Kode | Arti |
| --- | --- |
| `EMPTY`, `LIMIT` | Input kosong atau melewati batas 8.000 karakter, 200 baris, 50 node, 100 konektor, label 120 karakter |
| `LABEL` | Label kosong, terlalu panjang, atau memakai format aktif |
| `TEXT_SYNTAX` | Baris/indentasi/token kosong tidak sesuai grammar |
| `BRANCHES` | Kondisi tanpa satu Ya dan satu Tidak, cabang berulang, atau cabang di luar blok |
| `UNKNOWN_NODE` | `@label` atau referensi menuju node yang tidak didefinisikan |
| `CONFLICT` | Node didefinisikan ulang dengan label atau bentuk berbeda |
| `MERMAID_SYNTAX`, `UNSUPPORTED_OUTPUT` | Subset ditolak, atau hasil converter di luar elemen native yang didukung |
| `CONVERSION_FAILED`, `STALE` | Preview gagal dibuat, atau workspace/API berubah sejak preview dibuat |

Warning `NO_START`, `UNREACHABLE`, `DECISION_BRANCHES`, dan `DEAD_END` tidak memblokir preview; cycle dan self-loop juga sah. Validasi struktur tidak membuktikan kebenaran logika engineering.

### Batas lifecycle yang perlu diingat

- Insertion bersifat aditif: ID dan binding baru, satu group per diagram, posisi di pusat viewport, dan tepat satu langkah undo. Diagram lama tidak diganti.
- Mengedit atau memindahkan node tidak menyinkronkan sumber. `Mermaid` pada metadata adalah snapshot saat insertion; salin kode dari dialog sebelum menutup atau reload jika masih ingin mengubahnya.
- Input dan tab bertahan selama halaman terbuka, termasuk setelah dialog ditutup, tetapi tidak masuk draft dan hilang saat tab browser ditutup.
- Ganti workspace, seandainya bernama sama, membuat preview kedaluwarsa dan **Buat preview** harus ditekan ulang.
- Shortcut workspace (`Ctrl/Cmd+S`, `Ctrl/Cmd+O`, `Ctrl/Cmd+Backspace/Delete`) dinonaktifkan hanya ketika dialog Flowchart terbuka; mengetik di textarea tidak menjalankan shortcut drawing.

## Development dan verifikasi

Ubah kode sesuai area: editor di `src/features/editor`, persistence/file di `src/features/workspace`, AI di `src/features/ai`, flowchart lokal di `src/features/flowchart`, dan transport/validasi backend di `server`.

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
| LAN proxy | `npm run test:lan`: Caddy asli pada listener loopback, TLS terverifikasi, guard origin, mock generation |

Gate `npm run test:lan` memerlukan executable `caddy` di PATH dan gagal eksplisit bila tidak tersedia. Suite default tidak bergantung pada Caddy.

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
