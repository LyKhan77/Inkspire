# Third-party notices

Source Inkspire berlisensi [Apache-2.0](LICENSE). Notice berikut berlaku untuk komponen pihak ketiga yang dipakai; komponen tersebut tetap mengikuti lisensinya masing-masing.

Banner SVG `public/brand/readme-header.svg` dan `public/brand/readme-header-static.svg` memakai outline glyph dari font Space Grotesk dan IBM Plex Mono lokal. Teks lisensi OFL font tetap disertakan di `public/fonts/`; SVG tidak memuat atau mendistribusikan file font tambahan.

| Komponen | Notice |
| --- | --- |
| Excalidraw 0.18.1 | MIT; `public/excalidraw/licenses/Excalidraw.txt` |
| React / ReactDOM | MIT; license dalam package dependency dan salinan build di `public/notices/` |
| Tabler Icons | MIT; `public/brand/Tabler-LICENSE.txt` |
| Sharp / libvips | Apache-2.0 untuk Sharp; notice native distribution dipertahankan dalam dependency |
| Space Grotesk | SIL OFL; `public/fonts/Space-Grotesk-OFL.txt` |
| IBM Plex Mono | SIL OFL; `public/fonts/IBM-Plex-Mono-OFL.txt` |
| Font editor native | Metadata/teks license di `public/excalidraw/licenses/` |

Font native disalin utuh dari package Excalidraw: Assistant, Cascadia, Comic Shanns, Excalifont, Liberation Sans, Lilita, Nunito, Virgil, dan Xiaolai. Copyright/license metadata diekstrak dari WOFF2 yang benar-benar dibundel; komentar notice font berasal dari source map versi 0.18.1. Teks upstream tambahan disertakan untuk font yang memiliki license terpisah. Nama, copyright, dan metadata asli tidak diubah. Helvetica/emoji memakai font lokal sistem dan tidak didistribusikan sebagai file Inkspire.

Liberation yang dibundel membawa metadata Ascender 2007. Notice GPL v2 beserta pengecualian font dari [upstream legacy](https://github.com/liberationfonts/liberation-1.7-fonts/blob/main/License.txt) disertakan sebagai `Liberation-legacy-License.txt` dan `Liberation-legacy-COPYING`. Notice OFL upstream 2.x disimpan terpisah dan tidak dipakai untuk menamai ulang lisensi font lama.

`npm run assets:editor` menyalin font, worker font native beserta dependency graph aslinya, dan notice dependency terpasang. Worker disajikan lokal dari `public/excalidraw/worker/` agar build browser tidak ikut dimuat dalam worker. Package development mempertahankan lisensi aslinya dalam `node_modules`; notice build mencantumkan package runtime yang tersedia pada platform instalasi. Dependency native platform lain mengikuti license distributornya ketika diinstal.

Override dependency transitif disertakan dalam `package.json` untuk kompatibilitas React 19 dan temuan audit npm: Radix Tabs, Nano ID, Sass, Lodash ES, dan KaTeX. Hasil audit dependency tree tidak merupakan audit independen seluruh source yang sudah dibundel upstream Excalidraw.
