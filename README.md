# Kalkulator Buku Log Kenderaan (PWA)

PWA statik untuk membantu pengiraan akhir bulan Buku Log Penggunaan Kenderaan.

## Cara guna

1. Masukkan bulan/tahun.
2. Masukkan kapasiti tangki.
3. Masukkan kadar standard km/L (default 7).
4. Masukkan baki bahan api bulan lepas.
5. Masukkan odometer awal bulan.
6. Untuk setiap helaian:
   - semak odometer awal,
   - masukkan odometer akhir,
   - tambah rekod isi minyak jika ada,
   - tekan **Kira Helaian**.
7. Salin keputusan pada bahagian bawah helaian buku log.
8. Tekan **Helaian Seterusnya** sehingga helaian terakhir.
9. Tekan **Tamat Bulan & Lihat Ringkasan**.

## Kaedah pengiraan

### Jarak helaian
`Odometer akhir - Odometer awal`

### Baki akhir
Jika sudah ada rekod isi minyak dalam bulan tersebut:

`Kapasiti tangki - ((Odometer akhir semasa - Odometer isi minyak terakhir) / kadar standard)`

Jika belum ada isi minyak dalam bulan tersebut:

`Baki awal bulan - (jumlah jarak terkumpul / kadar standard)`

Baki akhir dibundarkan kepada nombor bulat terdekat.

### Jumlah penggunaan
`Baki awal + jumlah liter dibeli - baki akhir`

Jumlah penggunaan dibundarkan kepada nombor bulat terdekat.

### Kadar penggunaan
`Jumlah jarak terkumpul / jumlah penggunaan`

Kadar penggunaan dibundarkan kepada nombor bulat terdekat.

## Data ujian yang telah digunakan

Contoh bulan rujukan:

- Kapasiti tangki: 70 L
- Kadar standard: 7 km/L
- Baki awal: 49 L
- Odometer awal: 322463
- Odometer akhir: 323743
- Jumlah liter dibeli: 173.773 L
- Jumlah pembelian: RM805.87
- Isi minyak terakhir: odometer 323663

Keputusan akhir dengan pembundaran terdekat:

- Jarak: 1,280 km
- Baki akhir: 59 L
- Penggunaan: 164 L
- Kadar penggunaan: 8 km/L

## Deploy ke GitHub Pages

1. Cipta repository baharu di GitHub.
2. Upload **semua fail dan folder** projek ini ke root repository.
3. Pergi ke **Settings → Pages**.
4. Di **Build and deployment**, pilih **Deploy from a branch**.
5. Branch: `main`
6. Folder: `/ (root)`
7. Klik **Save**.
8. Tunggu GitHub Pages siap deploy.
9. Buka URL Pages yang diberi.

PWA boleh dipasang melalui browser yang menyokong pemasangan PWA / Add to Home Screen.

## Nota penyimpanan

Data pengiraan disimpan menggunakan `localStorage` pada peranti/browser semasa. Ia tidak dihantar ke server atau GitHub.
