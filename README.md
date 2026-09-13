# Don Grouper Assisstant

Bot Discord sederhana untuk server **Don Grouper Assisstant**. Bot ini memakai Node.js dan discord.js.

## Yang tersedia

- `/ping` untuk mengecek status bot
- `/bantuan` untuk melihat daftar command
- `/server` untuk melihat informasi server
- `/film tambah` untuk menyimpan film baru
- `/film list` untuk melihat daftar film
- Mention `@Don Grouper Assisstant` untuk menyapa bot
- Mention `@Don Grouper Assisstant pertanyaan` untuk bertanya ke Groq
- `/movie`, `/wherewatch`, dan `/trailer` untuk data film, streaming, dan trailer
- `/poll`, `/movieevent`, `/random`, `/watchlist`, `/letterboxd`, `/rate`, `/trivia`, dan `/card`

## Menjalankan bot

1. Install Node.js 18 atau lebih baru.
2. Buat aplikasi dan bot di [Discord Developer Portal](https://discord.com/developers/applications).
3. Pada menu **Bot**, aktifkan **Message Content Intent**.
4. Undang bot ke server dengan scope `bot` dan `applications.commands`. Bot membutuhkan permission `View Channels`, `Send Messages`, dan `Embed Links`.
5. Buat API key Groq di [Groq Console](https://console.groq.com/keys).
6. Salin `.env.example` menjadi `.env`, lalu isi token Discord, ID aplikasi, ID server, dan API key Groq. Gunakan `GROQ_MODEL=qwen/qwen3.8-27b`.
7. Buat API Read Access Token TMDB di [TMDB Settings](https://www.themoviedb.org/settings/api), lalu isi `TMDB_API_TOKEN`.
8. Jalankan:
6. Jalankan:

```bash
npm install
npm start
```

`DISCORD_GUILD_ID` adalah ID server Discord, bukan nama server. Untuk menyalin ID, aktifkan Developer Mode di Discord lalu klik kanan server dan pilih **Copy Server ID**.

Data film otomatis disimpan ke `films.json`, yang dibuat saat film pertama ditambahkan. Jangan membagikan file `.env` atau token bot.
