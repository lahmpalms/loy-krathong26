# ลอยกระทงออนไลน์

Vite + TypeScript frontend, Node API + SQLite (`server/server.mjs`, Node >= 22.13, ไม่มี dependency)

## Local
    npm install
    npm run api    # API ที่ 127.0.0.1:3026 (DB: server/krathong.db)
    npm run dev    # vite proxy /api ไปที่ API

## Deploy (VPS)
    ssh root@118.27.151.193 'bash -s' < deploy/setup.sh

nginx เสิร์ฟ `dist/` และ proxy `/api/` ไป systemd service `loykrathong26`
DB อยู่ที่ `/var/lib/loykrathong26/krathong.db` (ลบ/แก้ข้อมูลด้วย sqlite3 บนเครื่อง)
