# Akses Inkspire melalui LAN HTTPS

LAN memakai hasil build production. Companion tetap HTTP loopback; Caddy menangani HTTPS pada satu IP privat host. Ini mode optional untuk jaringan tepercaya, tanpa login atau sinkronisasi canvas.

Cakupan otomatis dan cakupan manual dipisah. Otomatis pada loopback dengan executable Caddy milik operator: render/validasi config, guard Origin/Host, jalur TLS tanpa SNI dengan verifikasi CA dan hostname, penolakan CA asing, path privat, asset frontend, dan generation mock (`npm run test:lan`; bukan bagian dari `npm test` karena membutuhkan binary). Perilaku foreground dan penghentian `lan:serve` dengan Ctrl+C juga sudah dibuktikan pada proses milik tes. Yang **belum** tercakup otomatis: trust certificate dan penggunaan pada device nyata; sign-off perangkat dicatat terpisah pada [verification](verification.md) dan tetap menjadi tindakan manual operator.

## Konfigurasi host

Pastikan executable Caddy dengan modul standar tersedia di PATH. Cek `caddy version`; instalasi mengikuti [caddyserver.com/docs/install](https://caddyserver.com/docs/install). Script Inkspire tidak memasang Caddy atau sertifikat OS otomatis.

Pilih IPv4 aktif pada Wi-Fi/Ethernet host. Isi `.env`:

```dotenv
INKSPIRE_PORT=4173
INKSPIRE_PUBLIC_ORIGIN=https://192.168.1.20:8443
```

`INKSPIRE_PUBLIC_ORIGIN` hanya menerima HTTPS dengan IPv4 privat RFC 1918 bentuk canonical dan port eksplisit `1024..65535`. Hostname, IPv6, alamat publik, HTTP, credential, query/fragment, dan path selain `/` ditolak. Kosongkan variable tersebut untuk kembali ke localhost. LAN hanya untuk mode production; `npm run dev` bersama LAN origin gagal saat startup.

Pertahankan konfigurasi MaPic hanya pada backend. Jangan membagikan `.env` atau private key. Untuk tes acceptance, arahkan backend ke mock milik harness, bukan layanan GPU nyata.

```bash
npm run build
npm run lan:config
caddy validate --config .inkspire-lan/Caddyfile --adapter caddyfile
```

Jalankan `npm start` pada terminal pertama dan `npm run lan:serve` pada terminal kedua. Gunakan Ctrl+C pada masing-masing terminal untuk stop. Admin API Caddy dimatikan, sehingga jangan menggunakan `caddy reload`/`caddy stop` untuk proses ini. Aplikasi di host juga diakses melalui URL HTTPS LAN yang sama.

## Sertifikat device

Setelah Caddy validate/start, root certificate berada di `.inkspire-lan/data/pki/authorities/local/root.crt`. File `.crt` ini boleh disalin ke device melalui sarana lokal yang Anda percayai. Jangan menyalin seluruh folder PKI atau file `.key`.

Tampilkan fingerprint root di host:

```bash
openssl x509 -in .inkspire-lan/data/pki/authorities/local/root.crt -noout -fingerprint -sha256
```

Bandingkan fingerprint sebelum memasang trust sesuai petunjuk resmi sistem/browser device. Beberapa browser memakai trust store sendiri; iOS dapat membutuhkan pengaktifan full trust setelah profile certificate diinstal. Jika device dikelola organisasi atau certificate installation dibatasi, minta administrator menangani trust. Jangan mengandalkan bypass warning TLS.

Verifikasi chain dan hostname dari host:

```bash
curl --cacert .inkspire-lan/data/pki/authorities/local/root.crt https://192.168.1.20:8443/
```

Buka URL yang sama di device. Halaman harus tanpa warning certificate dan `window.isSecureContext` harus true. UUID/hash, canvas, draft, Flowchart dan mock AI harus berjalan. Curl yang sukses tidak membuktikan trust browser device.

## Data dan penggunaan bersama

Draft tersimpan per browser/profile/device/origin. Alamat localhost dan HTTPS LAN memiliki draft berbeda. Export `.excalidraw` dari origin lama, lalu import pada origin baru untuk memindahkan pekerjaan. IP/port berubah juga membuat origin baru; pertimbangkan reservasi DHCP.

Semua device berbagi satu slot generation pada companion. Request kedua mendapatkan `REQUEST_ACTIVE` sampai request pertama selesai. Token MaPic tetap backend; preview dan canvas bukan shared workspace.

## Troubleshooting dan rollback

IP tidak terpasang: pilih interface aktif dan perbarui origin. Device tidak menjangkau host: periksa Wi-Fi yang sama, guest/client isolation, serta izin firewall TCP untuk port HTTPS tersebut. Certificate warning: pastikan root CA yang tepat dipercaya oleh browser device dan sertifikat cocok dengan IP origin.

LAN origin tidak dipakai bersama `npm run dev`; kosongkan variable tersebut untuk development localhost. Ganti konfigurasi dengan stop/start kedua proses dan regenerate Caddyfile. Tidak ada wildcard/HTTP fallback.

Untuk rollback, stop proxy dan companion LAN, kosongkan `INKSPIRE_PUBLIC_ORIGIN`, lalu jalankan companion localhost. Draft lama tetap ada. Jangan menghapus storage PKI untuk troubleshooting biasa karena penggantian CA memerlukan trust ulang. Cabut trust device manual bila LAN dihentikan permanen.

## Acceptance terisolasi untuk sign-off device

Harness berikut menjalankan companion, mock MaPic, dan Caddy dengan CA sendiri di `.inkspire-lan/acceptance`, tanpa membaca `.env` dan tanpa GPU nyata. Port dan IP wajib diberikan eksplisit:

```bash
INKSPIRE_PUBLIC_ORIGIN=https://192.168.1.20:18443 INKSPIRE_PORT=4193 \
  node --import tsx tests/start-lan-acceptance.ts
```

Harness mencetak acceptance URL, lokasi CA, dan mock control URL. Verifikasi TLS tanpa bypass memakai CA acceptance tersebut, bukan CA production. Kontrol mock hanya lewat loopback host:

```bash
curl -X POST -H 'Content-Type: application/json' --data '{"kind":"held"}' http://127.0.0.1:<mock-port>/__test/mode
curl -X POST http://127.0.0.1:<mock-port>/__test/release
```

Jangan arahkan control request ke MaPic asli. Setelah selesai, Ctrl+C harness dan cabut trust CA acceptance secara manual bila tidak lagi dipakai.