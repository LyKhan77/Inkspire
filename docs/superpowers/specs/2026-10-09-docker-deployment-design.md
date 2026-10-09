# Deployment Docker Inkspire untuk server LAN

Tanggal: 9 Oktober 2026.
Branch: `feat/docker-deployment`.
Status: rancangan untuk review sebelum eksekusi. Pengguna membatalkan Vercel dan memilih server pada LAN/internal yang sama dengan MaPic.

## Tujuan

Memindahkan frontend dan companion Inkspire ke server sebagai deployment Docker Compose production. Browser mengakses frontend dan API dari satu HTTPS origin LAN. Host server dapat menjangkau MaPic; token service tetap pada companion.

Target awal adalah Docker Engine Linux dengan networking host native. Tidak ada deployment atau perubahan server dalam sesi perencanaan. IP/port, arsitektur CPU, akses server, dan kredensial ditentukan operator saat eksekusi. Bila server bukan Linux atau memakai daemon rootless, desain networking ini perlu ditinjau sebelum deployment; jangan mengganti binding secara diam-diam.

## Pembersihan dan keadaan awal

- Spec Vercel `2026-10-09-vercel-frontend-lan-ai-design.md` dihapus atas permintaan pengguna; riwayat commit tetap dipertahankan.
- Tidak ada plan, kode, atau konfigurasi Vercel yang telah dibuat selain spec tersebut. Branch lokal `feat/vercel-deployment` sudah dibersihkan setelah commit-nya dipertahankan pada ancestry branch Docker.
- Implementasi LAN existing dan catatan historisnya tetap ada; fitur itu tidak dibatalkan.
- Pemeriksaan proses dan TCP listener tidak menemukan Inkspire/Caddy aktif pada device pengembangan. Listener Node yang tersisa berasal dari aplikasi lain dan tidak dihentikan. Docker CLI lokal ada, tetapi daemon pada socket lokal tidak aktif. Tidak ada aplikasi atau daemon yang dimulai ulang untuk perencanaan.

## Arsitektur yang dipilih

```text
Browser device ── HTTPS IP-LAN:port ──> proxy Caddy container
                                           └── HTTP 127.0.0.1:port ──> app container
                                                                         └── MaPic LAN API
```

Compose memiliki dua service yang berjalan lama dan satu service persiapan:

1. `lan-config`: image Inkspire, menjalankan CLI existing `--write-only`, memvalidasi IP host, lalu menulis Caddyfile ke volume lokal. Keluar setelah selesai; tidak menerima token MaPic.
2. `app`: image Inkspire production, frontend `dist` dan companion `dist-server`, tetap bind `127.0.0.1`. Menerima environment backend saat runtime.
3. `proxy`: image Caddy resmi, memakai konfigurasi hasil `lan-config`, bind satu IP LAN dan port HTTPS eksplisit. Tidak menerima environment/file kredensial MaPic.

Ketiganya memakai `network_mode: host`. Pada Docker Engine Linux, loopback dan IP interface yang dilihat container adalah milik host yang sama. Karena itu companion tetap loopback dan renderer/validasi interface existing dapat digunakan. Compose tidak memakai `ports:`, wildcard bind, host PID namespace, privileged mode, atau Docker socket di container aplikasi.

`app` dan `proxy` menggunakan PID/init handling serta restart policy masing-masing. `lan-config` hanya berjalan untuk persiapan. Proxy menunggu konfigurasi selesai sukses dan companion healthy pada startup. Dependency startup bukan watchdog: unhealthy tidak otomatis berarti restart, dan kesehatan companion tidak membuktikan readiness MaPic.

### Alternatif

- **Host networking Linux, dipilih:** mempertahankan boundary loopback dan konfigurasi LAN existing dengan sedikit perubahan aplikasi. Namespace network tidak terisolasi dari host; mitigasinya binding eksplisit, proses non-root, dan akses hanya LAN yang disetujui.
- **Bridge networking:** lebih terisolasi, tetapi companion loopback tidak dapat diakses container proxy terpisah. Memerlukan perubahan binding atau namespace, serta perubahan validasi IP/bind Caddy. Tidak dipilih untuk scope pertama.
- **Satu container dengan dua proses:** memerlukan supervisor dan aturan shutdown/restart tambahan. Tidak diperlukan karena Compose dapat mengelola service terpisah.

## Image dan build

- Multi-stage Dockerfile: build frontend/companion dengan lockfile, install dependency production pada stage terpisah, lalu salin hanya `dist`, seluruh `dist-server`, dependency production, dan license/notices ke runtime.
- Base Node 24 Debian Bookworm slim agar builder/runtime memakai ABI Linux yang sama untuk Sharp. Jangan menyalin `node_modules` atau binary dari macOS.
- Runtime memakai UID/GID Node non-root dan working directory `/app`, karena web serving mencari `dist` relatif terhadap cwd.
- Caddy tetap image resmi terpisah; binary tidak dibundel ke image Inkspire.
- `.dockerignore` membatasi context ke source/build inputs yang dibutuhkan, mengecualikan `.env`, temp, rencana, workspace pribadi, hasil tes, PKI, dependency/build lokal, dan Git metadata.
- Digest image resmi diverifikasi melalui metadata Docker Hub pada 9 Oktober 2026:
  - `node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20`
  - `caddy:2.11.7@sha256:f2a1290d0463aad60660d4ec134943f183ee2a5f6c3eb7bf32dd984f2f020772`
- Kedua index memuat Linux amd64 dan arm64. Metadata tag bukan bukti image sudah di-build atau generation sudah bekerja; executor wajib menguji native dependency dan TLS pada Linux.

## Runtime configuration dan data

Template bebas kredensial berada di `deploy/docker.env.example`. Operator membuat `.env.docker` pada server, bukan mengambil `.env` device secara otomatis. Compose membaca file itu saat runtime. `INKSPIRE_PUBLIC_ORIGIN` wajib berupa HTTPS IPv4 privat kanonis dengan port eksplisit, sesuai validator existing.

`MAPIC_BASE_URL` dan `MAPIC_SERVICE_TOKEN` hanya masuk service `app`; bukan build ARG/ENV, frontend, `lan-config`, atau `proxy`. Untuk MaPic pada host yang sama, gunakan endpoint yang benar-benar dapat dijangkau host, misalnya published loopback port; nama service Docker pada bridge tidak otomatis resolve dari host networking.

Volume `lan-state` menyimpan Caddyfile, PKI/data dan XDG state pada `/app/.inkspire-lan`. Volume dimiliki service non-root yang sesuai dan dipertahankan saat recreate/stop. Jangan memasukkan volume, private key, atau runtime environment ke Git/image.

Draft tetap IndexedDB per browser/profile/origin, bukan volume Docker. Prompt/preview tetap memori halaman. Migrasi ke origin server dilakukan melalui export/import `.excalidraw`. Tidak ada database, akun, cloud sync, atau shared canvas baru.

## HTTPS dan perilaku existing

Caddy tetap menangani sertifikat internal dan satu listener HTTPS. Companion tetap canonical Host/Origin, request marker, validasi body/gambar, satu generation aktif, timeout panjang, serta error tersanitasi. Tidak menambahkan CORS atau endpoint health/job/admin baru pada API.

Trust root CA pada device tetap tindakan manual. Docker tidak membuat certificate internal otomatis dipercaya browser. Sertifikat publik/domain atau proxy server existing dapat menjadi rancangan lanjutan; tidak ditambahkan ke scope ini tanpa validasi.

Frontend dan API tetap satu origin, sehingga tidak ada koneksi public-to-LAN dari Vercel. MaPic tetap di belakang companion dan tidak dipanggil browser secara langsung. Tidak ada tunnel atau layanan internet publik.

## Health dan lifecycle

- Healthcheck companion berupa HEAD `/` ke port HTTP loopback dengan Host canonical. Tidak memakai endpoint baru atau memanggil MaPic/GPU.
- Probe keluar 0 hanya jika mendapat 200; timeout, Host salah, config invalid, atau connection error keluar nonzero dengan pesan generik tanpa nilai operator.
- Proxy readiness diverifikasi melalui request HTTPS dengan CA dan hostname validation pada smoke/acceptance, bukan dari process-running atau config-validation saja.
- `init: true` dan stop grace period mengirim sinyal ke proses yang benar. Stop hanya mengelola project Compose yang dipilih, bukan semua Docker container/proses host.
- Stop selama generation dapat meninggalkan outcome unknown dan tidak membatalkan GPU; tidak ada auto-retry atau replay. IP/port conflict harus menyebabkan startup gagal, bukan mengubah bind/port.

## Verifikasi

1. Pemeriksaan syntax Compose dilakukan dengan env fixture, tanpa mencetak runtime environment nyata.
2. Unit/HTTP/typecheck/build existing ditambah regression healthcheck; image test membuktikan Node 24, UID non-root, Sharp Linux dapat dimuat, dan frontend/worker/font tersedia.
3. Smoke pada Linux memakai image hasil build, project Compose unik, IP LAN tes eksplisit, port bebas, fixture environment, dan mock loopback. Buktikan TLS terverifikasi, Host/Origin guards, path privat 404, T2I/I2I mock, satu slot generation, token tidak ke response/proxy, persistence CA setelah restart, dan cleanup project tes.
4. Gate Caddy existing dan E2E production tetap dijalankan untuk regression sesuai risiko perubahan.
5. Acceptance pada server/device nyata mencakup secure context, trust CA, draft/reload, export/import, Flowchart, bahasa/tema, dan generation mock. MaPic nyata hanya diuji setelah instruksi eksplisit pengguna; readiness HTTP bukan bukti autentikasi/generation service.

Docker Desktop pada macOS tidak dianggap bukti deployment ini: host networking Desktop tidak memberikan binding interface host seperti Linux. Daemon lokal saat perencanaan juga tidak aktif. Jangan mengaktifkan background Inkspire/Docker di device ini untuk menyembunyikan keterbatasan gate Linux.

## Transfer, operasi, dan rollback

Transfer menggunakan checkout/arsip tracked source pada commit yang disetujui, tidak seluruh workspace termasuk temp/env. Build image pada target Linux/runner yang sesuai; production host hanya memerlukan Docker Engine dan Compose, bukan npm/Node host.

Pilih image tag/digest deployment dan catat sebelum update. Setup environment, reserve port/IP, build, up, periksa health dan TLS, kemudian lakukan sign-off. Perubahan env memerlukan recreate; restart saja tidak memuat ulang env_file. Rollback memakai image sebelumnya dan konfigurasi yang sesuai, sambil mempertahankan PKI dan draft browser.

Production stop memakai `docker compose ... down` tanpa `--volumes`. Penghapusan volume hanya boleh untuk fixture tes yang dibuat sendiri dan project uniknya telah diverifikasi. Server/SSH, firewall, CA trust, push/merge/publish, serta generation nyata tetap tindakan terpisah sesuai instruksi operator.

Implementasi memperbarui README, ARCHITECTURE, WORKFLOW, CHANGELOG, AGENTS dan panduan Docker/verification. Plan berada di direktori ignored dan tidak di-commit.

## Referensi

- [Mode LAN existing](../../network-access.md)
- [Kontrak MaPic](../../mapic-contract.md)
- [Docker host networking](https://docs.docker.com/engine/network/drivers/host/)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Node.js guide](https://docs.docker.com/guides/nodejs/)
- [Compose services](https://docs.docker.com/reference/compose-file/services/)
