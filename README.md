# Backend Compana

## Deskripsi
Backend Compana adalah API server berbasis Node.js dan TypeScript yang dibangun menggunakan Express. Aplikasi ini menggunakan Prisma sebagai ORM untuk terhubung ke database MySQL.

## Tech Stack
- Node.js
- TypeScript
- Express 5
- Prisma
- MySQL
- dotenv
- cors
- helmet
- morgan
- cookie-parser

## Struktur Umum
- `src/` - kode sumber TypeScript
  - `server.ts` - titik awal server
  - `app.ts` - konfigurasi Express dan middleware
  - `config/` - konfigurasi aplikasi dan database
  - `middleware/` - middleware kustom
  - `modules/` - modul fitur / route
  - `routes/` - definisi route utama
  - `utils/` - utilitas pendukung
- `prisma/` - skema Prisma dan konfigurasi database
- `package.json` - skrip dan dependensi proyek
- `tsconfig.json` - konfigurasi TypeScript

## Prasyarat
- Node.js (versi 18 atau lebih baru direkomendasikan)
- npm
- MySQL

## Instalasi
1. Clone repository ini.
2. Masuk ke folder proyek:
   ```bash
   cd Backend-Compana
   ```
3. Install dependensi:
   ```bash
   npm install
   ```

## Konfigurasi Lingkungan
Buat file `.env` di root proyek dengan variabel berikut:
```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
```
Ganti `USER`, `PASSWORD`, `HOST`, `PORT`, dan `DATABASE` sesuai konfigurasi MySQL Anda.

## Setup Database Prisma
Setelah `.env` selesai diatur, jalankan migrasi atau sinkronisasi schema dengan Prisma:
```bash
npx prisma db push
```
Atau jika Anda menggunakan migrasi:
```bash
npx prisma migrate dev
```

## Menjalankan Aplikasi
- Mode development (watch + ts-node):
  ```bash
  npm run dev
  ```
- Build TypeScript:
  ```bash
  npm run build
  ```
- Jalankan hasil build:
  ```bash
  npm start
  ```

## Catatan
- Endpoint dan fitur API berada di folder `src/modules` dan `src/routes`.
- Prisma schema berada di `prisma/schema.prisma`.
- Pastikan MySQL berjalan dan variabel `DATABASE_URL` benar sebelum menjalankan aplikasi.

## Troubleshooting
- Jika server tidak berjalan, periksa error pada terminal.
- Pastikan dependensi sudah terpasang dan `DATABASE_URL` tersedia di `.env`.
- Jika ada perubahan pada schema Prisma, jalankan kembali `npx prisma db push` atau `npx prisma migrate dev`.
## Compana Backend

Express backend for the Compana frontend. AI/ML inference is proxied to the
FastAPI service in the sibling `ai-ml` repository through `AI_SERVICE_URL`.

### Local Run

Run AI service first from `ai-ml/`:

```bash
PYTHONPATH=. uvicorn ai_ml_module.app:app --host 0.0.0.0 --port 8000
```

Then run this backend:

```bash
cp .env.example .env
npm install
npm run dev
```

Important env:

```bash
PORT=5000
FRONTEND_URL=http://localhost:5173
AI_SERVICE_URL=http://localhost:8000
```

### AI Proxy Endpoints

- `GET /api/ai/health`
- `GET /api/ai/readiness`
- `GET /api/ai/model-status`
- `POST /api/ai/analyze-pretext`
- `POST /api/ai/select-questions`
- `POST /api/ai/submit-assessment`
- `POST /api/ai/evaluate-task`
- `POST /api/ai/update-progress`
