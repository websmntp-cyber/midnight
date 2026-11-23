# DESIGN.md · Gol Arena Futsal

Arah: **olahraga yang tenang dan premium**. Hijau hutan pekat + ivory hangat, huruf serif
untuk judul, satu aksen lime hanya di atas permukaan gelap. Dibuat tanpa referensi UXKIN
(tidak terhubung); keputusan diambil dari warna merek lama dan aturan kontras/ritme.

## Warna (peran)
| Token | Nilai | Peran |
|---|---|---|
| --ink | #0E1F17 | teks utama |
| --muted | #52625A | teks sekunder (kontras 5.6:1 di atas --bg) |
| --bg | #F6F3EB | latar halaman |
| --card | #FFFFFF | kartu, panel |
| --line | #E2DDCF | garis, border |
| --forest | #0B2A1F | tombol utama, header, seksi gelap |
| --lime | #C9F23C | aksen (hanya di atas --forest) |
| --danger | #9B2C20 | batal, error |
| --warn | #F3E3A6 | menunggu / hitung mundur |

## Tipografi
Judul: **Fraunces** 500/600 (tinggi baris 1.05). Isi: **Plus Jakarta Sans** 400/500/700.
Skala: 14 · 16 · 18 · 22 · 32 · clamp(40–72). Isi 16px+, baris maks ~65 karakter.

## Spasi, bentuk, kedalaman
Skala 4px (4·8·12·16·24·32·48·96). Konten maks 1160px. Radius 10 / 16 / 24 / pil.
Satu bayangan lembut (`--shadow`) untuk panel melayang; selebihnya garis tipis.

## Komponen
Tombol: utama (forest, teks lime), sekunder (garis), quiet (teks bergaris bawah). Semua punya
hover, `:focus-visible` (outline lime-hijau 3px) dan disabled. Slot jam: tersedia / dipilih
(forest) / terisi (coret, abu). Input 48px. Tiket: QR + kode.

## Citra dan ikon
Foto hero + foto lapangan dari pengaturan admin. Ikon: SVG garis 1.75px, tanpa emoji.
