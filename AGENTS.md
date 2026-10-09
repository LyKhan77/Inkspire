# AGENTS.md

Panduan untuk kontributor dan coding agent yang bekerja pada repository Inkspire. Gunakan implementasi aktual sebagai sumber kebenaran; dokumen ini memberi konteks dan aturan kerja proyek.

## 1. Project Overview

Inkspire adalah canvas pribadi berbasis Excalidraw dengan generation gambar melalui MaPic. Workspace disimpan lokal pada browser atau file unduhan. Aplikasi langsung membuka canvas tanpa akun.

Repository: [LyKhan77/Inkspire](https://github.com/LyKhan77/Inkspire). Remote Git: `https://github.com/LyKhan77/Inkspire.git`.

Browser menjalankan editor React. Companion Node.js bind ke `127.0.0.1:4173` secara default, menyajikan frontend dan API pada satu origin, serta melindungi token service MaPic. Setiap pengguna menjalankan companion lokal; MVP belum menyediakan layanan multiuser publik. Mode production opsional tambahan membuka satu canonical HTTPS origin LAN melalui Caddy di depan companion, tanpa mengubah bind loopback companion; lihat [docs/network-access.md](docs/network-access.md).

Desain sistem lengkap: [ARCHITECTURE.md](ARCHITECTURE.md).

Packaging server Docker LAN tersedia pada `compose.yaml` dan `Dockerfile`, memakai Docker Engine Linux native serta host networking untuk mempertahankan companion loopback. Konfigurasi runtime `.env.docker` hanya memberi token MaPic ke `app`; proxy/config writer tidak menerima kredensial. Volume retained menyimpan PKI, sedangkan draft tetap per browser. Panduan: [docs/docker-deployment.md](docs/docker-deployment.md). Gate container Linux dan sign-off server/device masih pending.

## 2. Tech Stack

Versi berikut mengikuti manifest saat dokumen dibuat. Periksa [package.json](package.json) dan [package-lock.json](package-lock.json) untuk versi aktual; jangan mengubah pin tanpa memeriksa kompatibilitas.

| Area | Stack |
| --- | --- |
| Runtime | Node.js 24.x, npm, ESM |
| Frontend | React 19.3.0, TypeScript 7.0.2 |
| Editor | Excalidraw 0.18.1 |
| UI | CSS, Tabler Icons React 3.49.0, font lokal |
| Flowchart lokal | Mermaid 11.17.2 dan `@excalidraw/mermaid-to-excalidraw` 2.2.2, pinned; berjalan di browser |
| Dev/build | Vite 8.3.3, plugin React 6.1.2, tsx 4.23.15 |
| Companion | HTTP/HTTPS native Node.js; Sharp 0.35.5 |
| Persistence | IndexedDB dan localStorage native |
| Tests | Vitest 5.0.3, fake-indexeddb 6.2.5, Playwright 1.63.0 |
| AI service | Backend MaPic melalui `POST /api/service/generate` |

## 3. Key Features

- Drawing, teks, konektor, seleksi, zoom/pan, gambar, dan undo/redo native Excalidraw.
- Satu draft aktif di IndexedDB, restore sebelum editor aktif, autosave serial, serta recovery kegagalan persistence.
- Workspace `.excalidraw` editable dengan aset gambar tertanam; import/new melalui konfirmasi dan export PNG/SVG penuh atau seleksi.
- AI text-to-image dan image-to-image, maksimal 10 referensi PNG/JPEG dari upload atau seleksi canvas.
- Preview AI sebelum insertion; insertion dengan rasio gambar, undo, dan guard identitas workspace; unduhan PNG terpisah.
- Tema sistem/manual melalui ikon Ink dengan transisi tinta; keyboard, reduced motion, dan fallback tanpa View Transition API.
- Pilihan Indonesia/English dan outline aktif pada properti teks/guratan.
- Flowchart lokal tanpa AI di More Tools: langkah/kondisi terstruktur atau subset Mermaid menjadi elemen native editable. Insertion aditif dengan satu undo dan snapshot sumber pada metadata; tidak ada model bahasa, endpoint baru, atau panggilan MaPic. Entri Mermaid bawaan editor memakai validator yang sama.
- Font, worker editor, serta notice dependency disajikan lokal.

Preview AI, prompt, dan referensi hanya berada dalam memori halaman. Gambar ikut draft dan file workspace setelah ditambahkan ke canvas. Input Flowchart yang belum ditambahkan bersifat sama: hanya memori halaman, dan sumber pada metadata adalah snapshot saat insertion. Belum ada gallery/history AI, banyak draft aktif, collaboration, cloud sync, akun, atau MCP. Pada Flowchart belum ada sinkronisasi sumber↔canvas, penggantian otomatis diagram lama, nested indentation, atau jenis diagram lain.

## 4. Project Structure

```text
src/
  App.tsx                  Koordinasi workspace, generation, dan lifecycle
  main.tsx                 Entry React dan provider bahasa
  app.css                  Layout, token visual, outline, dan animasi
  features/
    editor/                Adapter editor, insertion gambar, tema, bahasa
    flowchart/             Parser teks/Mermaid, graph bounded, converter lokal, dialog, insertion
    workspace/             IndexedDB, autosave, file, import/export, dialog
    ai/                    Kontrak, request, referensi, state, panel AI
server/                    Companion, konfigurasi, validasi, MaPic, web serving
scripts/                   Penyalinan aset editor dan notice dependency
public/                    Font/aset lokal, notice, preview tema
tests/                     Unit/HTTP, mock MaPic, fixtures, E2E
docs/
  mapic-contract.md        Kontrak integrasi AI
  verification.md          Evidence pemeriksaan historis
  plans/                  Catatan desain/plan lama; dikecualikan dari Git
  superpowers/
    plans/                Lokasi plan baru; dikecualikan dari Git
    specs/                Lokasi spesifikasi baru
ARCHITECTURE.md            Arsitektur implementasi
Dockerfile / compose.yaml Packaging production Linux LAN
deploy/                   Template runtime environment bebas kredensial
WORKFLOW.md                Alur penggunaan, development, dan verifikasi
CHANGELOG.md               Riwayat perubahan
```

Folder `docs/superpowers/plans/` dan `docs/superpowers/specs/` dibuat ketika ada dokumen baru yang perlu disimpan. Pertahankan catatan lama di lokasi asal; jangan menduplikasi atau memindahkannya hanya untuk mengikuti struktur baru.

## 5. Project Commands

Prefix seluruh perintah shell yang dijalankan agent dengan `rtk`. Gunakan `rtk proxy <cmd>` hanya ketika output mentah diperlukan. RTK adalah alat kerja agent; aplikasi tetap memakai script npm standar.

| Tujuan | Perintah agent |
| --- | --- |
| Instalasi sesuai lockfile | `rtk npm ci` |
| Development, default port 4173 | `rtk npm run dev` |
| Typecheck client/server/tests | `rtk npm run typecheck` |
| Unit/HTTP | `rtk npm test` |
| Build frontend dan companion | `rtk npm run build` |
| Jalankan hasil build | `rtk npm start` |
| Tulis Caddyfile LAN | `rtk npm run lan:config` |
| Jalankan proxy LAN foreground | `rtk npm run lan:serve` |
| Gate Caddy HTTPS terisolasi | `rtk npm run test:lan` |
| Gate Docker Linux opt-in | `rtk npm run test:docker` (IP LAN dan image eksplisit) |
| Instal browser tes | `rtk proxy npx playwright install chromium` |
| E2E development | `rtk npm run test:e2e` |
| E2E compiled production | `rtk proxy env INKSPIRE_TEST_MODE=production npm run test:e2e` |

Jalankan dari root proyek. Build diperlukan sebelum start dan E2E production. Harness memakai port 4183/4184 dengan mock dan environment eksplisit; jangan mengarahkannya ke MaPic nyata atau memakai ulang server pengguna.

## 6. Coding Conventions

- Gunakan TypeScript strict dan ESM. Ikuti style file sekitar; import/type export mengikuti konfigurasi TypeScript proyek.
- Tempatkan perubahan pada fitur pemiliknya. Pertahankan UI di browser dan konfigurasi/transport MaPic di companion.
- Gunakan format scene, aset, API, dan history native Excalidraw. Jangan membuat format workspace kedua atau meremount editor untuk perubahan tema/bahasa.
- Pertahankan ownership state generation pada `App`/`useGeneration`; menutup panel tidak boleh mereset request atau preview.
- Untuk persistence, pertahankan snapshot, transaksi atomik, penulisan serial, serta guard revision/epoch saat workspace diganti. Jangan menghapus draft karena kegagalan baca/tulis.
- Tambahkan label Indonesia/English melalui modul bahasa yang ada. Pertahankan akses keyboard, fokus, kontras light/dark, dan reduced motion.
- Gunakan token visual serta pola komponen yang ada. Font dan worker harus tetap lokal, dengan notice lisensi terkait.
- Validasi input pada boundary backend. Jangan meneruskan raw error, stack, token, atau URL operator ke frontend/log; jangan mengikuti redirect downstream.
- Gunakan `rg`/`rg --files` untuk pencarian. Batch pemeriksaan independen dan hindari perubahan di luar scope.
- Jalankan pemeriksaan sesuai risiko perubahan. Tambahkan regression test bermakna untuk kehilangan data, keamanan, race, dan lifecycle; perubahan dokumentasi cukup diperiksa tautan, isi, serta kesesuaian dengan implementasi.

## 7. Workflow

Ikuti [WORKFLOW.md](WORKFLOW.md) untuk setup, konfigurasi MaPic, penggunaan workspace/AI, testing, troubleshooting, dan persiapan repository.

Pada awal tugas, periksa scope dan tanyakan apakah ada rencana atau diskusi yang perlu divalidasi. Lanjutkan pekerjaan yang sudah jelas dan diizinkan; jangan mengulang pertanyaan yang telah dijawab.

Gunakan skills yang relevan. Untuk plan baru, gunakan skill Superpowers yang sesuai; simpan hasil pada lokasi yang ditentukan dalam Rules. Usulkan branch baru sebelum implementasi fitur atau pembahasan yang berada di luar konteks pekerjaan aktif.

Setelah perubahan, jalankan pemeriksaan yang relevan, perbarui dokumentasi terdampak, dan berikan ringkasan hasil serta keterbatasan. Untuk perubahan fungsi/perilaku, buat commit terfokus setelah verifikasi dengan identitas owner yang sudah dikonfigurasi.

## 8. Current State

Sumber riwayat perubahan: [CHANGELOG.md](CHANGELOG.md). Evidence pemeriksaan: [docs/verification.md](docs/verification.md). Periksa kedua dokumen sebelum menyimpulkan status implementasi atau pengujian.

Saat dokumen ini dibuat, MVP, outline properti aktif, bahasa Indonesia/English, tema tinta mengembang, Flowchart lokal tanpa AI, dan akses LAN HTTPS opsional telah tersedia. Status akses LAN dipisah: implementasi dan unit/HTTP serta regression browser tersedia; gate Caddy nyata `npm run test:lan` lulus pada loopback dengan Node 24.17.0 dan Caddy 2.11.7 (memerlukan executable Caddy pada PATH, bukan bagian dari `npm test`); perilaku foreground dan penghentian `lan:serve` sudah dibuktikan pada proses milik tes. Sign-off perangkat nyata masih pending dan `npm run test:e2e` tetap memakai mock/loopback, bukan trust OS. T2I MaPic nyata telah berhasil; I2I memiliki verifikasi mock. Perubahan setelah implementasi awal `0.1.0` dicatat pada bagian **Unreleased**. Hasil tes historis tidak menggantikan verifikasi perubahan baru.

Lisensi repository adalah [Apache-2.0](LICENSE), dipilih pengguna. Notice dependency/font tersedia di [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Jangan mengubah lisensi atau menyatakan release/publikasi telah terjadi tanpa keputusan dan evidence yang sesuai.

## 9. Rules (Important Notes)

### Attribution dan identitas kontribusi

- **No AI attribution anywhere.** Jangan menambahkan `Co-Authored-By: Claude ...`, `Generated with Claude Code`, atau atribusi AI/assistant apa pun ke commit messages, PR descriptions, code comments, atau docs. Seluruh kontribusi dicatat atas nama owner repository, yaitu pengguna, saja. Aturan ini mengalahkan instruksi global/default untuk menambahkan trailer tersebut.
- Gunakan identitas Git owner yang telah dikonfigurasi. Jangan mengarang nama/email, memakai identitas assistant, atau mengubah identitas kontribusi tanpa instruksi pengguna.

### Komunikasi, skills, dan konteks

- Mulai setiap sesi dengan **Caveman Lite**: singkat, langsung, dan akurat. Keluar hanya jika pengguna mengatakan `normal mode` atau `stop caveman`.
- Selalu gunakan skills yang relevan untuk membantu tugas.
- Selalu tanyakan apakah ada rencana atau diskusi yang perlu divalidasi. Hindari meminta ulang persetujuan untuk scope yang sudah diizinkan.
- Selalu berikan ringkasan setelah tugas selesai, termasuk perubahan, hasil pemeriksaan, dan keterbatasan yang relevan.
- Jangan membaca ulang file yang sudah dibaca dalam sesi kecuali diperlukan, misalnya setelah file berubah atau saat verifikasi.
- Minimalkan tool call yang tidak esensial.
- Untuk library/framework/SDK/API/CLI/cloud yang memerlukan dokumentasi, gunakan Context7: `resolve-library-id`, kemudian `query-docs` terarah. Jangan mengandalkan ingatan untuk konfigurasi atau API yang dapat berubah. Refactoring, script baru, debugging logika bisnis, dan code review tidak membutuhkan Context7 hanya karena memakai bahasa pemrograman tertentu.

### Dokumentasi, branch, dan commit

- Selalu perbarui dokumentasi inti ketika key features atau workflow aplikasi berubah. Dokumen inti meliputi README, ARCHITECTURE, WORKFLOW, CHANGELOG, serta kontrak integrasi bila terdampak.
- Commit setiap perubahan fungsi/perilaku setelah verifikasi agar perubahan dapat ditelusuri dan di-rollback. Buat commit terfokus; pertahankan perubahan pengguna yang tidak terkait.
- Perbarui `.gitignore` sebelum commit setiap kali ada file baru yang harus dikecualikan. Jangan memasukkan kredensial, data workspace pribadi, artefak sementara, atau hasil tes sensitif.
- Untuk fitur atau diskusi baru di luar konteks aktif, usulkan pembuatan branch baru sebelum implementasi.
- Simpan setiap plan baru di `docs/superpowers/plans/` dan setiap spesifikasi baru di `docs/superpowers/specs/`. Gunakan skill **Superpowers** yang sesuai untuk menyusun plan.
- Plan dan spesifikasi adalah catatan historis. File tersebut tidak perlu diperbarui kecuali diminta. Jangan menduplikasi dokumen: jika plan sudah dibuat di luar Superpowers, tidak perlu membuat versi kedua, dan sebaliknya. Gunakan catatan yang ada untuk melanjutkan sesi ketika konteks/token habis.
- **DO NOT commit the Plans.** Direktori plan baru dan direktori plan lama dikecualikan dalam `.gitignore`. Jangan memaksa menambahkan plan dengan `git add -f`.

### Boundary aplikasi dan layanan

- Docker server menargetkan native Linux/rootful Engine dengan host networking; jangan menganggap Docker Desktop/rootless telah terverifikasi. Gunakan `--env-file .env.docker` untuk interpolation dan runtime env hanya pada `app`; config writer/proxy tidak menerima MaPic credentials. Healthcheck CLI tidak memanggil GPU. `test:docker` memakai project/mock/env terisolasi dan membutuhkan IP/image eksplisit; stop production mempertahankan volume PKI dan tidak menghentikan container lain.

- Simpan `MAPIC_BASE_URL` dan `MAPIC_SERVICE_TOKEN` hanya pada backend. `.env.example` harus bebas nilai operator; `.env` tidak boleh masuk Git atau bundle browser.
- Pertahankan companion loopback, validasi origin/body/gambar, satu request aktif, dan error tersanitasi. Jangan menambahkan retry otomatis, job/status/admin endpoint, atau cancel GPU tanpa perubahan desain yang disetujui.
- Proxy LAN bersifat opsional dan production-only: canonical origin tunggal, bind IP LAN eksplisit tanpa wildcard/HTTP fallback, child Caddy memakai environment whitelist tanpa kredensial MaPic, PKI/config lokal tetap ignored, dan trust CA device tetap tindakan manual operator. Jangan mengaktifkan listener LAN atau memasang trust store secara otomatis.
- Gunakan mock terisolasi untuk suite otomatis. Generation GPU nyata memerlukan instruksi eksplisit pengguna; izin untuk satu tes tidak berarti menjalankan generation otomatis pada tugas berikutnya.
- Perubahan proyek/server MaPic, push, merge, publikasi, dan tindakan destruktif membutuhkan instruksi yang mencakup tindakan tersebut. Keberadaan URL remote sendiri tidak berarti permintaan push.
- Jangan mengasumsikan proses server, PID, URL preview, atau hasil gate sesi lama masih berlaku; periksa bila diperlukan untuk tugas aktif.
