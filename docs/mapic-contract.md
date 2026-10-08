# Kontrak generation Inkspire ↔ MaPic

Browser memanggil **POST `/api/ai/generate`** pada origin companion. Companion memanggil **POST `/api/service/generate`** pada URL backend dari `MAPIC_BASE_URL`, dengan `Authorization: Bearer` dari `MAPIC_SERVICE_TOKEN`. Browser tidak membawa token, downstream URL, JWT Supabase, atau Authorization.

Companion bind `127.0.0.1`; origin normal `http://127.0.0.1:4173`. Request generation memerlukan Host/origin kanonis, `Content-Type: application/json`, dan `X-Inkspire-Client: 1`. Cross-site ditolak; tidak ada wildcard CORS, proxy URL bebas, status job, admin endpoint, atau antrean tambahan.

## Request

```json
{
  "prompt": "Ilustrasi tinta hitam",
  "negative_prompt": "",
  "resolution": 1024,
  "num_inference_steps": 40,
  "true_cfg_scale": 1
}
```

I2I menambahkan `images`, array base64 PNG/JPEG tanpa prefix data URL. Tanpa referensi adalah T2I. Field lain ditolak companion. Prompt dipertahankan; trim hanya dipakai untuk pemeriksaan kosong.

| Batas | Nilai |
| --- | --- |
| Prompt | Nonempty setelah trim, ≤2000 Unicode code points |
| Referensi | ≤10 PNG/JPEG, single frame, decode penuh |
| Raw body | ≤32 MiB, dihitung dari chunk sebenarnya |
| Base64 per referensi | ≤2.800.000 karakter |
| Byte per referensi | ≤2 MiB setelah base64 decode |
| Dimensi referensi | Sisi ≤2048 px, total ≤4.194.304 piksel |
| Steps | Integer 20–75; default 40 |
| CFG | Finite 1–3; default 1 |
| Resolusi | 1024 |
| Negative prompt | String opsional; tetap tunduk batas raw body |

## Response

Sukses blocking mengembalikan satu PNG:

```json
{ "data": [{ "b64_json": "BASE64_PNG" }] }
```

Tidak ada URL cloud, job ID, atau upload/history. Companion membatasi respons JSON **32 MiB** dan hasil decode **16.777.216 piksel** lalu memvalidasi PNG penuh. Ini batas defensif hasil; batas 2 MiB referensi tidak diterapkan pada hasil.

Error lokal disanitasi:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Prompt wajib diisi, maksimal 2000 karakter.",
    "field": "prompt",
    "outcomeUnknown": false
  }
}
```

`field` opsional. Body/error downstream, stack trace, Authorization, prompt, dan gambar tidak diteruskan ke log atau response browser.

| HTTP | Makna |
| --- | --- |
| 400 | JSON/UTF-8/body tidak valid |
| 403 | Host, Origin, client marker, atau cross-site ditolak |
| 405 | Method generation harus POST |
| 409 | `REQUEST_ACTIVE`: companion masih menunggu satu request |
| 413 | Body/base64/decoded reference melebihi batas |
| 415 | Media type harus JSON |
| 422 | Prompt, field, parameter, format/dimensi gambar tidak valid |
| 401 | Autentikasi MaPic perlu diperiksa di backend |
| 429 | Antrean layanan penuh; coba manual nanti |
| 500/502 | Layanan/transport/hasil gagal; pesan umum |
| 503 | Konfigurasi companion kosong atau service belum diaktifkan |
| 504 | Deadline; generation mungkin masih berjalan |

Penolakan admission/input/config memiliki `outcomeUnknown:false`. Timeout, koneksi ambigu setelah pengiriman, dan hasil/layanan gagal yang tidak memastikan penolakan memiliki `outcomeUnknown:true`. Status tidak dikenal, redirect, atau body sukses tidak valid menjadi 502; redirect tidak diikuti.

## Lifecycle dan transport

Timeout MaPic **3.600.000 ms**, deadline transport companion **3.660.000 ms**. Receiving-body timeout dipisahkan dari menunggu generation. Companion menjaga satu request aktif sampai downstream selesai/deadline, termasuk setelah browser disconnect. Tidak ada auto-retry atau queue Inkspire.

MaPic memiliki admission gabungan maksimal 10 job per proses dan inference serial. Angka ini tidak memberi posisi antrean atau progress request Inkspire. Health/model ready bukan bukti autentikasi service atau generation sukses. Service job tidak masuk active-list pengguna, tidak membuat history/upload Supabase, dan tidak memakai JWT pengguna; startup MaPic sendiri tetap memerlukan konfigurasi Supabase.

Membatalkan transport lokal tidak berarti GPU dibatalkan. Reload tidak memulihkan request/preview dan tidak mengirim ulang generation. Input/canvas tetap tersedia ketika generation gagal. HTTP LAN tidak mengenkripsi Bearer; gunakan HTTPS/transport terlindungi jika jaringan tidak dipercaya.

Tes kontrak memakai mock loopback dan credential sentinel khusus tes. Generation GPU nyata memerlukan izin terpisah. Pengguna mengizinkan dan T2I nyata berhasil pada 8 Oktober 2026; evidence di [verifikasi](verification.md).
