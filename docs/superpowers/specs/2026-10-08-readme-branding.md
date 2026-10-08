# README branding

Pengguna meminta header README kreatif dan ikon Ink animasi SVG, lalu menyetujui penggunaan branding yang ada: paper hangat, ink, dan vermilion.

## Hasil dan batas

- Banner `public/brand/readme-header.svg`: 1280×416, bingkai editorial, ikon Ink besar, wordmark lowercase, tagline, dan label personal canvas/open source/local first.
- Ikon mandiri `public/brand/ink-animated.svg`: 256×256, background transparan, cocok untuk branding terpisah.
- Fallback `public/brand/readme-header-static.svg`: komposisi banner yang sama, tanpa animasi. README memilihnya melalui elemen picture dan source media reduced motion.
- Animasi CSS loop 6,6 detik: bead jatuh, tetes settle, ripple, lalu jeda. Banner memiliki swash yang digambar pada fase awal.
- Media reduced motion pada dokumen SVG langsung menonaktifkan semua animasi. Verifikasi menemukan emulasi Chromium tidak menerapkan preferensi tersebut pada SVG image yang sama; pilihan source statis pada picture menghindari ketergantungan tersebut untuk header README. Bead/ripple tersembunyi pada fallback dan komposisi dasar tetap lengkap. Warna mengikuti media light/dark.
- Tidak memakai JavaScript, SMIL, foreignObject, request generation, atau resource eksternal. Semua tipografi banner menjadi path dari font lokal Space Grotesk/IBM Plex Mono, dengan notice OFL yang ada.
- README memakai gambar relatif dan alt text, ditambah navigasi ringkas. Source aplikasi/editor, MaPic, dan draft pengguna tidak diubah.

## Verifikasi

Periksa XML, ID/reference, dependency eksternal, tautan README, dan ukuran aset. Render sebagai gambar di browser pada light/dark dan lebar desktop/mobile. Bandingkan dua frame untuk membuktikan motion; pada reduced motion frame harus tetap identik. Tinjau screenshot dan lakukan commit terfokus dengan identitas owner. Plan lokal tidak di-commit.
