# Deployment Docker pada server LAN

Mode ini menargetkan Docker Engine Linux native dengan Compose v2. Konfirmasi OS/CPU, IPv4 privat interface server, port HTTP companion dan HTTPS yang kosong, serta endpoint MaPic yang dapat dijangkau host. Docker Desktop dan daemon rootless belum menjadi target terverifikasi. Server production cukup membutuhkan Docker/Compose; Node 24 dan dependency development pada host hanya diperlukan untuk suite verifikasi.

Status saat ini: packaging dan harness sudah diimplementasikan. Gate container Linux, deployment server, serta acceptance perangkat nyata masih pending. Verifikasi aktual dicatat di [verification.md](verification.md).

## Quickstart dengan script

[scripts/docker.sh](../scripts/docker.sh) memakai Bash dan membungkus Compose existing. Script dapat dipanggil dari direktori mana pun; root proyek ditentukan dari lokasinya. Tidak memerlukan npm/Node pada host production.

```sh
./scripts/docker.sh init
nano .env.docker
./scripts/docker.sh up
```

`init` membuat template private mode 0600, dan mempertahankan file existing. Edit origin LAN dan konfigurasi MaPic sesuai tabel di bawah memakai editor pilihan Anda. `up` memeriksa Linux/native/rootful daemon serta context lokal, memvalidasi config tanpa mencetak environment, membangun image dan recreate semua service. Script memakai project `inkspire` dan `.env.docker` dari checkout ini, membersihkan override `INKSPIRE_PORT`, `INKSPIRE_PUBLIC_ORIGIN`, `INKSPIRE_IMAGE` dalam proses script, dan menetapkan `INKSPIRE_ENV_FILE` secara eksplisit. File environment tidak di-source/eval.

| Perintah | Operasi |
| --- | --- |
| `./scripts/docker.sh status` | Status semua service project ini |
| `./scripts/docker.sh export-ca` | Export hanya root certificate publik ke `inkspire-lan-root.crt` |
| `./scripts/docker.sh down` | Stop project ini dengan volume PKI retained |
| `./scripts/docker.sh help` | Bantuan tanpa efek samping |

Trust certificate/fingerprint tetap manual. Status startup belum membuktikan TLS/MaPic readiness. `up` kembali melakukan recreate; stop/recreate selama generation dapat meninggalkan outcome unknown. Untuk update/rollback, pilih image tag dan config yang sesuai dahulu. Perintah Compose manual tetap tersedia di bawah. Regression helper memakai fixture CLI saja; gate container Linux masih pending.

## Transfer dan konfigurasi

Pindahkan checkout atau arsip **tracked source pada commit yang disetujui**, bukan seluruh folder kerja. Jangan membawa `.env` device, `temp`, dependency/build macOS, file canvas pribadi, atau PKI lama tanpa keputusan operator. Image membangun frontend, companion dan dependency native Linux dari lockfile.

Salin template pada server:

```sh
cp deploy/docker.env.example .env.docker
chmod 600 .env.docker
```

Isi melalui editor, tanpa mencetak kredensial ke terminal/report:

| Variable | Nilai operator |
| --- | --- |
| `INKSPIRE_PUBLIC_ORIGIN` | Wajib, `https://<IPv4-privat-server>:<port-eksplisit>`; HTTPS port `1024..65535` |
| `INKSPIRE_PORT` | Port HTTP companion pada loopback, default `4173`; berbeda dari port HTTPS |
| `INKSPIRE_IMAGE` | Tag image deployment, misalnya `inkspire:docker-local`; gunakan tag unik untuk setiap update |
| `MAPIC_BASE_URL` | Endpoint backend MaPic yang reachable dari host server |
| `MAPIC_SERVICE_TOKEN` | Service token aktif tanpa prefix `Bearer`; hanya service `app` menerimanya |

Format mengikuti env-file Compose. Jika nilai berisi `$` atau `#`, gunakan single quotes agar tetap literal; quotes pembungkus tidak menjadi bagian token. Jangan memakai prefix `VITE_` atau memasukkan token ke build ARG. `.env.docker` diabaikan Git dan build context. Jangan menjalankan `docker compose config` tanpa `--quiet` pada konfigurasi operator karena output memuat environment backend.

Canvas tetap bisa digunakan tanpa MaPic. Status healthy companion tidak menguji autentikasi atau readiness MaPic.

Semua service menggunakan host networking Linux. MaPic pada host yang sama dapat memakai endpoint loopback yang dipublish; MaPic pada server lain memakai alamat LAN yang reachable. Nama service bridge Docker tidak otomatis resolve dalam host networking. Companion tetap bind `127.0.0.1`; tidak ada `ports:` mapping. Akses firewall TCP ke port HTTPS dan pemilihan IP adalah tindakan operator, bukan otomatisasi aplikasi.

## Build dan start

Jalankan dari root repository pada server setelah deployment diizinkan. Pakai satu nama project yang konsisten; `-p inkspire` pada contoh menghindari perubahan nama karena folder checkout dipindah.

```sh
docker compose -p inkspire --env-file .env.docker config --quiet
docker compose -p inkspire --env-file .env.docker build lan-config
docker compose -p inkspire --env-file .env.docker up -d
docker compose -p inkspire --env-file .env.docker ps --all
```

`lan-config` memakai image Inkspire dan keluar 0 setelah memvalidasi IP host serta menulis Caddyfile. `app` menyajikan `dist` dan API; healthcheck melakukan HEAD loopback dengan Host kanonis tanpa generation. `proxy` menunggu config berhasil dan companion healthy, lalu menyajikan HTTPS pada satu IP/port yang dipilih. Healthcheck bukan watchdog: status unhealthy tidak otomatis merestart proses yang masih hidup. Proxy running juga belum membuktikan TLS berhasil.

Ketiganya non-root, root filesystem read-only, tanpa capability tambahan, privileged mode atau akses socket Docker. Volume `lan-state` diinisialisasi dari direktori image milik UID/GID `1000:1000`; config dan proxy memakai UID yang sama. Bila bootstrap volume gagal, periksa project tersebut; jangan menjalankan semua service root atau mengubah izin direktori host lain.

## Sertifikat dan verification HTTPS

Export **hanya root certificate publik**, bukan private key:

```sh
docker compose -p inkspire --env-file .env.docker cp proxy:/app/.inkspire-lan/data/pki/authorities/local/root.crt ./inkspire-lan-root.crt
openssl x509 -in inkspire-lan-root.crt -noout -fingerprint -sha256
```

File export root dikecualikan dari Git. Bandingkan fingerprint melalui kanal lokal yang dipercayai sebelum memasang trust CA **manual** pada device/browser. Jangan menyalin `root.key`, folder PKI, atau environment. Docker tidak membuat sertifikat internal otomatis dipercaya browser. Panduan trust device ada pada [mode LAN](network-access.md).

Verifikasi chain dan hostname tanpa bypass (ganti IP/port contoh dengan origin operator):

```sh
curl --cacert inkspire-lan-root.crt https://192.168.50.20:8443/
```

Browser device harus membuka origin yang sama tanpa warning dan memiliki secure context. Jangan memakai `curl -k` sebagai sign-off. Sertifikat/domain publik, tunnel dan internet hosting belum termasuk mode ini.

## Data pengguna dan acceptance

Volume menyimpan konfigurasi proxy, CA/PKI dan XDG state; **canvas tidak disimpan pada server**. Draft tetap IndexedDB per browser/profile/origin. Prompt, referensi dan preview yang belum ditambahkan tetap memori halaman. Gambar yang sudah ditambahkan ikut draft dan file workspace.

Pindahkan workspace dari origin lokal dengan export `.excalidraw`, kemudian import pada origin HTTPS server. Perubahan IP/port mengubah origin storage. Semua device berbagi satu slot generation pada companion, bukan satu workspace bersama.

Acceptance perangkat nyata: trusted HTTPS/secure context, canvas load, draft setelah reload, export/import dengan aset gambar, Flowchart editable dan undo, bahasa/tema, serta AI dengan mock. MaPic nyata hanya diuji setelah instruksi eksplisit; mock tidak membuktikan token operator valid.

## Gate Linux terisolasi

Runner Linux memerlukan Node 24, dependency development, Docker/Compose dan image hasil build. Test IP harus disetujui operator dan benar-benar ada pada interface privat host; contoh berikut bukan alamat server yang telah dikonfirmasi:

```sh
npm ci
docker build --pull --tag inkspire:docker-local .
INKSPIRE_DOCKER_TEST_IP=192.168.50.20 INKSPIRE_DOCKER_TEST_IMAGE=inkspire:docker-local npm run test:docker
```

Harness menolak macOS, Docker Desktop, remote context, daemon rootless dan `DOCKER_HOST` override. Ia memakai mock loopback, port bebas, env fixture private, nama project unik dan volume tes sendiri. Tidak membaca `.env`/`.env.docker` operator, memasang trust OS, atau memanggil GPU. Gate membuktikan TLS/hostname, guard Host/Origin, jalur privat, mock T2I/I2I, slot tunggal, isolasi token, stop dan CA retention. `test:docker` opt-in dan tidak menjadi dependency `npm test`.

Cleanup normal menghapus project/volume fixture sendiri. Jika cleanup gagal, harness melaporkan project dan lokasi fixture yang dipertahankan; periksa lalu bersihkan **project tes tersebut saja**. Jangan menghentikan semua container atau menghapus volume production. Hindari memutus proses harness secara paksa; pastikan project tes tidak tertinggal setelah interupsi.

## Update, stop dan rollback

Sebelum update, catat commit, tag/image ID yang aktif, dan simpan salinan konfigurasi secara privat. Build dengan tag unik, ubah `INKSPIRE_IMAGE`, validasi lalu recreate semua service agar penulis config berjalan lagi:

```sh
docker compose -p inkspire --env-file .env.docker build lan-config
docker compose -p inkspire --env-file .env.docker config --quiet
docker compose -p inkspire --env-file .env.docker up -d --force-recreate
docker compose -p inkspire --env-file .env.docker ps --all
```

Restart saja tidak memuat ulang `env_file`. Recreate config writer juga diperlukan ketika origin/port berubah. Pertahankan tag image sebelumnya dan jangan overwrite PKI untuk memperbaiki config. Rollback: restore image tag dan konfigurasi sebelumnya, recreate, kemudian verifikasi health dan HTTPS lagi. Draft browser tetap pada origin masing-masing; origin yang berubah memerlukan export/import.

Stop hanya project ini, tanpa menghapus volume:

```sh
docker compose -p inkspire --env-file .env.docker down
```

Jangan menambahkan `--volumes` pada stop production. Volume retained mempertahankan CA, sehingga recreate normal tidak memerlukan trust ulang. Stop selama generation dapat meninggalkan outcome unknown dan tidak membatalkan GPU; jangan replay otomatis. Periksa status/log yang disanitasi ketika startup gagal, terutama konflik port/IP, permissions volume dan companion readiness.

Semua perintah shell kontributor/agent memakai prefix `rtk`; contoh operator tetap berupa perintah aplikasi standar.
