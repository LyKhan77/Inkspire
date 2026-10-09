# Frontend Vercel dengan AI Image melalui companion LAN

Tanggal: 9 Oktober 2026.
Branch: `feat/vercel-deployment`, dari `feat/network-access` pada `afcb9aa83c1b1494083522212f75094a13d50493`.
Status: rancangan untuk validasi sebelum implementasi. Dokumen ini tidak menyatakan deployment atau koneksi perangkat nyata telah berhasil.

## Tujuan dan keputusan arsitektur

Frontend Inkspire di-host sebagai aset statis di Vercel dan dapat memakai domain Vercel atau custom domain. Companion tetap pada host LAN yang dapat menjangkau MaPic. Browser device menghubungi companion LAN secara langsung melalui HTTPS; request AI tidak melewati Vercel Functions atau external rewrite.

```text
Browser device ── HTTPS ──> frontend/domain Vercel
Browser device ── HTTPS ──> Caddy pada IP LAN eksplisit
                              └── HTTP loopback ──> companion Inkspire
                                                       └── service API ──> MaPic
```

Deployment frontend tidak memberikan Vercel akses ke LAN. Jalur AI bergantung pada akses jaringan device ke companion dan akses host companion ke MaPic. Tanpa akses itu, canvas, Flowchart, file, bahasa, dan tema tetap tersedia; AI menunjukkan status koneksi yang sesuai.

Tidak ada tunnel, VPN, listener backend internet, Vercel Functions, perubahan server MaPic, atau cloud sync dalam scope ini. Domain frontend tidak memindahkan draft browser ataupun kredensial backend.

## Alternatif yang dipertimbangkan

1. **Frontend Vercel + companion LAN, dipilih.** Domain publik untuk frontend, AI dipakai dari device yang dapat mengakses LAN. Memerlukan konfigurasi endpoint, CORS spesifik, sertifikat dipercaya, dan verifikasi browser/device.
2. **Backend cloud menghubungi MaPic melalui penghubung jaringan.** Memungkinkan AI di luar LAN, tetapi menambah tunnel/VPN/private routing dan mengubah boundary layanan; tidak dipilih.
3. **Frontend Vercel tanpa AI.** Deployment lebih sederhana, tetapi tidak memenuhi kebutuhan mempertahankan AI Image; tidak dipilih.

## Deployment dan kompatibilitas lokal

- Tambahkan script `build:hosted`: penyalinan aset lokal yang sudah ada, kemudian `vite build --mode hosted`. Output hanya frontend di `dist`.
- Project Vercel memakai preset Vite, build `npm run build:hosted`, dan output `dist`. Tidak menjalankan `npm start` atau Caddy di Vercel.
- Mode hosted dikenali melalui mode build Vite. Pada mode ini, AI memerlukan endpoint companion eksplisit sebelum mengirim request; jangan mencoba `/api/ai/generate` pada domain frontend.
- Mode lokal tetap memakai endpoint relatif same-origin secara default. Script `dev`, `build`, `start`, dan `lan:*` tetap berfungsi dengan perilaku yang ada.
- Font, worker editor, notice, dan aset editor tetap berada pada hasil build statis. Konfigurasi routing tidak boleh mengubah API yang hilang menjadi respons HTML sukses.
- Domain final dan origin companion adalah nilai operator saat setup. Tidak ada IP/domain operator yang di-hardcode dalam source. Custom domain memerlukan kepemilikan domain dan konfigurasi DNS; domain `.vercel.app` juga dapat dipakai.
- Token/URL MaPic tidak dibutuhkan oleh project Vercel. Jangan menambahkan keduanya sebagai variable `VITE_*`, ke konfigurasi statis, atau ke bundle.

## Konfigurasi frontend dan UX koneksi

- Tambahkan pengaturan koneksi pada panel AI, dengan label Indonesia dan English, input origin companion, tombol simpan/reset, serta tindakan cek koneksi.
- Pada mode hosted, origin companion wajib HTTPS dengan IPv4 privat RFC 1918 kanonis dan port eksplisit `1024..65535`, mengikuti boundary mode LAN saat ini. Credential URL, path tambahan, query, fragment, wildcard, dan alamat publik ditolak sebelum request.
- Pilihan endpoint tersimpan pada browser/profile/origin frontend. Ini pengaturan koneksi, bukan bagian scene/file `.excalidraw`. Tidak ada scan jaringan atau deteksi endpoint otomatis.
- Pada mode lokal, reset kembali ke endpoint same-origin. Pada mode hosted, reset kembali ke kondisi belum dikonfigurasi.
- Perubahan endpoint diblokir selama generation aktif. Request memakai snapshot endpoint saat dimulai; status koneksi dari endpoint lama tidak boleh diterapkan setelah endpoint berubah. Menutup panel tetap mempertahankan request/preview sesuai lifecycle existing.
- Pemeriksaan koneksi hanya atas tindakan pengguna. Hasil lama dapat menjadi kedaluwarsa; jangan menyebut koneksi selalu online dari hasil pemeriksaan sebelumnya. Preview/sumber input dan canvas tidak dihapus karena koneksi gagal.
- Status membedakan: belum dikonfigurasi, sedang diperiksa, companion merespons, MaPic belum dikonfigurasi, dan koneksi tidak dapat diverifikasi.
- Browser dapat menyamarkan kegagalan TLS/CORS/izin LAN/network menjadi error fetch yang sama. Tampilkan panduan cek jaringan, trust CA, izin browser, dan origin tanpa mengarang diagnosis tertentu atau mengungkap raw error.

## Host dan Origin merupakan dua konfigurasi berbeda

`INKSPIRE_PUBLIC_ORIGIN` tetap berarti origin canonical companion LAN untuk TLS/Caddy dan pemeriksaan HTTP Host. Jangan menggantinya dengan domain Vercel.

Tambahkan `INKSPIRE_ALLOWED_FRONTEND_ORIGIN` sebagai satu origin HTTPS frontend yang diizinkan, opsional dan default kosong. Parse secara kanonis, tanpa credential, path selain `/`, query, fragment, atau wildcard. Hanya origin yang benar-benar dikonfigurasi yang diizinkan; preview domain Vercel tidak diterima otomatis.

- HTTP Host selalu harus sesuai origin companion LAN, termasuk port. Host asing tetap ditolak.
- Untuk endpoint AI yang ditentukan di bawah, Origin boleh berupa origin companion existing atau origin frontend yang dikonfigurasi.
- Origin asing, `null`, dan Origin yang hilang ditolak pada request API aktual. Header forwarded tidak menjadi sumber kebenaran Host/Origin.
- `Sec-Fetch-Site: cross-site` dapat diterima hanya pada route AI yang tepat dan Origin frontend yang cocok persis. Larangan existing untuk request lain tetap dipertahankan.
- Request aktual tetap membutuhkan `Content-Type: application/json` dan `X-Inkspire-Client: 1`.
- Ini allowlist origin browser, bukan autentikasi pengguna. Companion tetap untuk jaringan tepercaya sesuai model LAN existing; fitur login atau layanan publik multiuser berada di luar scope.

## CORS dan preflight

Untuk `/api/ai/generate` dan `/api/ai/connection` saja:

- `OPTIONS` memeriksa Host, Origin, requested method `POST`, serta requested headers case-insensitive dari subset `content-type` dan `x-inkspire-client`.
- Jangan mewajibkan body JSON atau client marker aktual pada preflight karena browser mengirimkan nama header yang akan digunakan, bukan nilainya.
- Preflight yang diizinkan menerima 204 dengan `Access-Control-Allow-Origin` exact origin, allowed method/header yang terbatas, dan `Vary: Origin`. Tidak memakai `*` atau credential cookies.
- Origin/method/header yang tidak diizinkan ditolak tanpa CORS grant, tanpa membaca payload generation, dan tanpa call MaPic. Preflight tidak mengambil slot generation.
- Response sukses maupun error request aktual dari Origin yang sah membawa CORS header yang tepat, sehingga error 401/409/413/503/504 dapat dibaca UI. Origin yang ditolak tidak mendapatkan grant.
- Jangan membuka CORS untuk file privat, seluruh `/api/*`, frontend companion, atau endpoint admin/status/job lainnya.
- Caddy tetap memakai IP LAN eksplisit, satu listener HTTPS, fallback Host 403, environment whitelist, dan trust CA manual. Backend tetap bind loopback.

## Pemeriksaan koneksi tanpa inference

Tambahkan **POST `/api/ai/connection`** dengan body JSON objek kosong `{}`. Terapkan guard Host/Origin/client marker, batas body kecil, penolakan field lain, CORS, dan `Cache-Control: no-store`.

Respons sukses berisi hanya status readiness lokal, misalnya `{ "backendReady": true, "mapicConfigured": true }`. `mapicConfigured` berarti URL dan token MaPic terkonfigurasi di companion; **tidak membuktikan** konektivitas downstream, kecocokan token, model siap, atau generation sukses. Nilai false ditampilkan sebagai konfigurasi MaPic belum tersedia.

Endpoint ini tidak melakukan request MaPic/GPU, tidak mengambil slot generation, dan tidak mengembalikan URL MaPic, token, prompt, hasil gambar, detail PKI, atau environment operator. Tidak menambahkan health/job/admin endpoint pada MaPic.

Status backend harus didasarkan pada respons valid, bukan hanya keberhasilan `fetch`, HTTP 200, atau halaman HTML. Status seluruh pipeline hanya dianggap teruji setelah generation benar-benar selesai, dan dicatat untuk sesi/endpoint tersebut; status itu tetap historis, bukan jaminan availability berikutnya.

## Kontrak generation yang dipertahankan

Frontend mengirim kontrak `/api/ai/generate` existing ke companion yang dipilih. Companion memanggil `/api/service/generate` MaPic memakai kredensial backend. Upload/ref PNG/JPEG, base64 hasil, preview, insertion, download, guard workspace, serta undo tetap sama.

Batas body 32 MiB, maksimum 10 referensi, timeout downstream/companion, error tersanitasi, dan satu slot generation per companion tetap dipertahankan. Tidak ada retry otomatis, polling job, queue Inkspire, cancel GPU, atau request terulang setelah reload. Dua frontend/device yang memakai companion sama berbagi slot generation tersebut.

Frontend Vercel tetap menyimpan draft per browser/profile/origin. Perpindahan dari localhost/LAN ke domain Vercel menggunakan export/import `.excalidraw`; tidak ada migrasi otomatis atau sinkronisasi antar device.

## Verifikasi dan acceptance

### Gate otomatis dengan mock

1. Unit konfigurasi endpoint/origin mencakup input valid, canonicalization, alamat yang ditolak, dan default lokal/hosted.
2. HTTP tests membuktikan preflight yang sah, CORS pada sukses/error, Origin asing tidak memperoleh grant, Host tetap ketat, Sec-Fetch-Site handling terbatas, serta connection check tidak memanggil MaPic atau mengubah slot.
3. Dua request generation melalui frontend origin sah tetap menghasilkan satu pending dan satu 409; setelah release mock, request pertama 200.
4. Browser E2E memakai frontend dan companion pada origin terpisah, HTTPS terverifikasi, dan mock MaPic. Buktikan T2I/I2I, error dapat dibaca, preview/insertion/undo, endpoint snapshot, persistence pengaturan, bahasa, serta canvas tetap dapat dipakai ketika companion tidak tersedia.
5. Build hosted menyajikan font/worker lokal dan tidak menyertakan credential sentinel. Jalankan gate Caddy existing serta regresi lokal production agar mode localhost/LAN tetap terjaga.
6. Typecheck, suite unit/HTTP, build lokal/hosted, serta browser suites sesuai risiko harus lulus sebelum functional commit.

Loopback atau dua origin lokal tidak membuktikan kebijakan akses public-to-LAN pada browser nyata. Jangan melaporkan gate terisolasi sebagai sign-off domain Vercel.

### Acceptance domain Vercel pada LAN nyata

1. Deploy frontend; catat domain yang benar-benar dipakai. Konfigurasikan exact domain tersebut pada companion, lalu jalankan companion/Caddy dengan origin LAN yang dipilih operator.
2. Pasang trust CA secara manual dan izinkan akses jaringan lokal bila browser meminta. Verifikasi per browser/device target; Chrome/Edge maupun Safari/Firefox tidak dinyatakan kompatibel hanya dari tes pada browser lain.
3. Buka frontend dari domain Vercel, simpan endpoint LAN, dan cek koneksi. Buktikan companion merespons dan UI membedakan konfigurasi MaPic dari generation berhasil.
4. Gunakan harness acceptance mock terisolasi untuk membuktikan request dari domain hosted sampai ke mock, referensi/insertion berjalan, serta busy-slot antar dua device. Jangan mengganti environment server pengguna diam-diam.
5. Generation MaPic nyata dilakukan hanya dengan instruksi eksplisit pengguna. Satu T2I yang berhasil membuktikan rantai domain frontend → companion → autentikasi service → generation → preview/insertion untuk konfigurasi yang diuji. I2I nyata dicatat terpisah bila diizinkan dan diuji.
6. Catat kegagalan saat companion berhenti, endpoint salah, akses LAN tidak tersedia, izin browser ditolak, atau CA belum dipercaya. UI tetap usable dan tidak mencoba generation ulang otomatis.

Persiapan deployment, kelulusan mock, readiness lokal, dan keberhasilan MaPic nyata harus dicatat sebagai evidence yang berbeda. Domain final, perangkat/browser target, IP/port companion, serta kepemilikan akun/domain diberikan operator saat deployment; semua merupakan input konfigurasi, bukan nilai source.

## Dokumentasi dan rollback

Implementasi memperbarui README, ARCHITECTURE, WORKFLOW, CHANGELOG, panduan LAN, kontrak MaPic, `.env.example` bebas nilai operator, serta verification. Tambahkan panduan hosting frontend dan perbedaan antara endpoint companion, allowed frontend origin, dan URL MaPic.

Pengaturan default kosong mempertahankan mode lokal. Rollback hosting mengembalikan deployment frontend sebelumnya; rollback koneksi mereset endpoint browser dan mengosongkan allowed frontend origin pada companion. Draft dan file tidak dihapus; PKI tidak diregenerasi untuk rollback rutin. Trust CA tetap tindakan manual operator.

Artefak deployment lokal baru, PKI, kredensial, dan output tes tetap ignored sebelum commit. Branch ini tidak otomatis menggabungkan atau mempublikasikan branch LAN sebelumnya.

## Referensi

- [Arsitektur existing](../../../ARCHITECTURE.md)
- [Kontrak MaPic existing](../../mapic-contract.md)
- [Mode LAN HTTPS existing](../../network-access.md)
- [Vite pada Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Domain Vercel](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Chrome Local Network Access](https://developer.chrome.com/blog/local-network-access)
