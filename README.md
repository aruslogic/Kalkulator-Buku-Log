# Kalkulator Buku Log UPB — V2

PWA statik untuk kegunaan **PERSENJATAAN | UPB** bagi membantu pengiraan Buku Log Kenderaan hujung bulan.

## Ciri utama V2
- UI mobile-first dan branding PERSENJATAAN | UPB.
- Ikon rasmi projek menggunakan imej yang dibekalkan pengguna.
- Aliran: Maklumat Bulan → Helaian → Keputusan → Tambah Helaian / Selesai Pengiraan.
- Soalan Ya/Tidak sebelum paparan rekod isi minyak.
- Sokongan lebih daripada satu rekod isi minyak bagi satu helaian.
- Odometer awal helaian berikutnya disambung automatik.
- Jarak helaian dipaparkan secara live.
- Autosave input helaian ke localStorage.
- Ringkasan akhir dan semakan semua helaian.
- Pengguna boleh sambung pengiraan selepas melihat ringkasan.
- Service worker menggunakan network-first ketika online, jadi tidak perlu menukar CACHE_NAME setiap kali kemas kini.

## Formula
Pembundaran menggunakan nombor bulat terdekat (`Math.round`).

Jika pernah isi minyak pada bulan tersebut:
`baki akhir = kapasiti tangki - ((odometer akhir - odometer isi minyak terakhir) / kadar standard)`

Jika belum pernah isi minyak:
`baki akhir = baki awal - (jarak terkumpul / kadar standard)`

`penggunaan = baki awal + jumlah liter dibeli - baki akhir dibundarkan`

`kadar = jarak terkumpul / penggunaan dibundarkan`

## GitHub Pages
Upload semua fail dengan struktur folder dikekalkan, kemudian aktifkan GitHub Pages daripada branch `main` dan folder root `/`.
