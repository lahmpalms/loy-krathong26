# ลอยกระทงออนไลน์

Vite + TypeScript frontend, Node API + SQLite (`server/server.mjs`, Node >= 22.13, ไม่มี dependency)

## Local
    npm install
    npm run api    # API ที่ 127.0.0.1:3026 (DB: server/krathong.db)
    npm run dev    # vite proxy /api ไปที่ API

## Deploy (VPS 118.27.151.193)
https://loykrathong26.lahmpalms.me → Caddy ของ stagebatt (`/opt/stagebatt/Caddyfile` มี block loykrathong26) → 172.28.0.128:8026 → container

    ssh root@118.27.151.193 'cd /opt/loykrathong26 && git pull && docker compose -p loykrathong26 up -d --build'

DB อยู่ใน docker volume `loykrathong26_data`
ถ้า stagebatt deploy แล้ว Caddyfile ถูกเขียนทับ ต้องเพิ่ม block นี้กลับ:

    loykrathong26.lahmpalms.me {
        import safe_access_log
        reverse_proxy 172.28.0.128:8026
    }
