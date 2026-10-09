# Docker quickstart dan helper shell

Tanggal: 2026-10-09. Branch: `feat/docker-deployment`.

Pengguna meminta quickstart README dan script `.sh` agar deployment LAN yang sudah disetujui mudah dijalankan. Perubahan ini menyederhanakan operasi existing; arsitektur Docker/HTTPS/MaPic tidak berubah.

## Pendekatan

Pilihan yang dipakai: wrapper Bash `scripts/docker.sh` di atas Compose existing. README tetap memberi urutan singkat dan link panduan lengkap. Operator mengisi environment secara manual dengan editor.

Alternatif copy/paste Compose membutuhkan banyak perintah berulang. Wizard kredensial menambah parsing/input sensitif serta setup otomatis yang belum diperlukan; tidak termasuk scope.

## Perilaku

- Tanpa argumen atau `help`: tampilkan usage saja. Argumen tidak dikenal/berlebih gagal sebelum efek samping.
- `init`: buat `.env.docker` dari template dengan mode 0600 jika belum ada. Pertahankan file existing; tidak memerlukan Docker dan tidak memulai app.
- `up`: validasi Linux native/rootful Docker dan context lokal, pastikan env file tersedia, validasi Compose tanpa mencetak config, build `lan-config`, recreate semua service dengan retained volume, lalu tampilkan status. Tidak melakukan generation atau trust installation.
- `status`: tampilkan service project `inkspire` melalui Compose.
- `down`: stop project yang sama tanpa menghapus volume atau container lain.
- `export-ca`: salin hanya root certificate publik ke `inkspire-lan-root.crt`; trust/fingerprint tetap manual.
- Root ditentukan dari lokasi script, sehingga invocation dari direktori lain dan path berspasi tetap benar. Project name `inkspire` konsisten dengan panduan existing.
- `.env.docker` tidak di-source/eval. Script menunjuk env file milik checkout ini secara eksplisit; override konfigurasi Inkspire dari shell dibersihkan dalam proses script agar file menjadi sumber konfigurasi.
- OS/context/daemon/config failure keluar nonzero sebelum build/start. Detail parsing config dan env tidak dicetak. Jangan mengklaim startup/status sebagai bukti TLS/MaPic readiness.

## Verifikasi dan dokumentasi

Regression menjalankan Bash dengan Docker/uname fixture terisolasi; tidak memakai daemon, listener, GPU, file env operator atau trust store. Buktikan init private/idempotent, path berspasi, penolakan platform/context, sanitasi error, env tidak dieksekusi, urutan build/recreate/status, stop retained volume dan certificate-only export. Syntax Bash, typecheck dan suite unit harus lulus sebelum commit.

README memberi `init` → edit `.env.docker` → `up`, lalu status/down/export-ca. Panduan Docker, WORKFLOW, ARCHITECTURE, CHANGELOG, AGENTS dan verification diperbarui sesuai workflow. Image/Linux container gate dan device acceptance tetap pending seperti checkpoint sebelumnya. Tidak ada push, deploy atau local daemon startup pada pekerjaan ini.
