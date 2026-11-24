# ลอยกระทงออนไลน์ 🪷

เว็บลอยกระทงออนไลน์ ผู้ใช้ใส่ชื่อ คำอธิษฐาน เลือกแบบกระทงและสี แล้วกดลอย กระทงของทุกคนลอยอยู่ในแม่น้ำเดียวกันและอัปเดตให้เห็นแทบทันที เมื่อจบงาน หน้าแรกจะเปลี่ยนเป็นเครดิตท้ายเรื่อง เลื่อนแสดงชื่อและคำอธิษฐานของทุกคน

ตั้งใจให้เป็นโปรเจกต์ตั้งต้นที่เล็กและอ่านจบได้ในบ่ายเดียว ไม่มี framework ฝั่งหน้าเว็บ ไม่มี dependency ฝั่ง server และใช้ฐานข้อมูลเป็นไฟล์ SQLite ไฟล์เดียว

เอกสารนี้ไล่ตั้งแต่รันบนเครื่องตัวเอง ปรับแต่ง build เป็น Docker เช่า VPS ตั้ง DNS เปิด HTTPS ไปจนถึงสำรองข้อมูลและดูแลหลังขึ้นระบบ ทุกตัวอย่างใช้โดเมนสมมติ `krathong.example.com` และ IP สมมติ `203.0.113.10` ให้แทนด้วยของคุณเอง

---

## สารบัญ

1. [ฟีเจอร์](#1-ฟีเจอร์)
2. [สถาปัตยกรรม](#2-สถาปัตยกรรม)
3. [โครงสร้างไฟล์](#3-โครงสร้างไฟล์)
4. [สิ่งที่ต้องมี](#4-สิ่งที่ต้องมี)
5. [รันบนเครื่องตัวเอง](#5-รันบนเครื่องตัวเอง)
6. [ตัวแปร environment](#6-ตัวแปร-environment)
7. [API](#7-api)
8. [ปรับแต่ง](#8-ปรับแต่ง)
9. [เปิดงาน / ปิดงาน](#9-เปิดงาน--ปิดงาน)
10. [รันด้วย Docker บนเครื่องตัวเอง](#10-รันด้วย-docker-บนเครื่องตัวเอง)
11. [Deploy ขึ้น VPS](#11-deploy-ขึ้น-vps)
12. [ตั้งค่า DNS](#12-ตั้งค่า-dns)
13. [HTTPS ด้วย Caddy](#13-https-ด้วย-caddy)
14. [หน้า Admin](#14-หน้า-admin)
15. [อัปเดต สำรอง และกู้ข้อมูล](#15-อัปเดต-สำรอง-และกู้ข้อมูล)
16. [ความปลอดภัย](#16-ความปลอดภัย)
17. [แก้ปัญหาที่พบบ่อย](#17-แก้ปัญหาที่พบบ่อย)

---

## 1. ฟีเจอร์

- ลอยกระทงพร้อมชื่อ (ไม่เกิน 30 ตัวอักษร) และคำอธิษฐาน (ไม่เกิน 80 ตัวอักษร)
- กระทง 5 แบบ วาดด้วย SVG ล้วน: ใบตอง เบียร์ เอกสาร ขนมปัง กาแฟ OT และเลือกสีได้ 5 สี
- กระทงลอยเป็นเลน มี perspective และเอฟเฟกต์น้ำ แตะที่กระทงเพื่ออ่านคำอธิษฐาน
- ดึงรายการใหม่ทุก 5 วินาที (หยุดดึงเมื่อแท็บถูกซ่อน)
- จำกัดการโพสต์ 6 ครั้งต่อนาทีต่อ IP
- หน้า `/admin` สำหรับลบกระทงที่ไม่เหมาะสม ตรวจรหัสผ่านฝั่ง server
- โหมดปิดงาน: server ไม่รับกระทงใหม่ หน้าแรกแสดงเครดิตท้ายเรื่อง

## 2. สถาปัตยกรรม

```
 เบราว์เซอร์
     │  HTTPS :443
     ▼
 ┌──────────────┐   http://app:3026   ┌──────────────────────────────┐
 │ Caddy        │ ──────────────────▶ │ Node (server/server.mjs)     │
 │ - TLS อัตโนมัติ │                     │ - /api/*  → JSON API         │
 │ - reverse    │                     │ - อื่น ๆ   → ไฟล์ใน dist/       │
 │   proxy      │                     │ - SQLite (node:sqlite)       │
 └──────────────┘                     └──────────────┬───────────────┘
                                                     │
                                              /data/krathong.db
                                              (docker volume)
```

- **Frontend**: Vite + TypeScript ไม่มี framework build ออกมาเป็นไฟล์ static ใน `dist/`
- **Backend**: `server/server.mjs` ไฟล์เดียว ใช้แค่ built-in ของ Node (`node:http`, `node:sqlite`, `node:crypto`) ต้องใช้ Node 22.13 ขึ้นไป เพราะ `node:sqlite` เปิดใช้โดยไม่ต้องใส่ flag ตั้งแต่เวอร์ชันนั้น
- **Production**: container เดียวทำทั้ง API และเสิร์ฟหน้าเว็บ โดยมี Caddy อยู่ข้างหน้าเพื่อทำ HTTPS
- **Development**: Vite เสิร์ฟหน้าเว็บที่พอร์ต 5173 และ proxy `/api` ไปที่ Node พอร์ต 3026

## 3. โครงสร้างไฟล์

```
.
├── index.html          # โครง HTML, ฟอร์ม, ฟอนต์ Mitr
├── src/
│   ├── main.ts         # จุดเริ่มต้น: วาดแม่น้ำ ดาว ฟอร์ม เลน admin
│   ├── store.ts        # เรียก API (GET/POST/DELETE) และ polling
│   ├── kinds.ts        # SVG ของกระทงแต่ละแบบ
│   ├── credits.ts      # เครดิตท้ายเรื่องตอนปิดงาน
│   └── style.css
├── server/
│   └── server.mjs      # API + static server + SQLite
├── vite.config.ts      # proxy /api ไป 127.0.0.1:3026 ตอน dev
├── Dockerfile          # multi-stage: build ด้วย Node แล้วรันด้วย Node
├── compose.yml         # compose ตัวอย่าง (ดูหัวข้อ 11 ก่อนใช้)
└── package.json
```

## 4. สิ่งที่ต้องมี

| ใช้ทำอะไร | ต้องมี |
|---|---|
| พัฒนาบนเครื่อง | Node.js **22.13+** และ npm, git |
| รันด้วย Docker | Docker Engine + Docker Compose v2 |
| ขึ้นระบบจริง | VPS 1 เครื่อง (1 vCPU / 1 GB RAM พอ), โดเมน 1 ชื่อ |

เช็กเวอร์ชัน:

```bash
node -v            # ต้องได้ v22.13.0 ขึ้นไป
docker compose version
```

## 5. รันบนเครื่องตัวเอง

```bash
git clone https://github.com/<your-account>/loy-krathong.git
cd loy-krathong
npm install
```

เปิด 2 terminal:

```bash
# terminal 1: API ที่ 127.0.0.1:3026 ฐานข้อมูลอยู่ที่ server/krathong.db
npm run api

# terminal 2: หน้าเว็บที่ http://localhost:5173
npm run dev
```

ถ้าต้องการทดสอบหน้า admin ตอน dev ให้ส่งรหัสผ่านให้ API:

```bash
ADMIN_PASSWORD=devpass npm run api
```

แล้วเปิด http://localhost:5173/admin

คำสั่งอื่น:

```bash
npm run build     # type-check (tsc) แล้ว build ลง dist/
npm run preview   # เปิดดูผล build ด้วย vite
```

ทดลองให้ Node เสิร์ฟผล build เองแบบเดียวกับ production:

```bash
npm run build
STATIC_DIR="$PWD/dist" npm run api   # เปิด http://127.0.0.1:3026
```

> `STATIC_DIR` ต้องเป็น path เต็ม (absolute) เพราะ server ใช้มันตรวจว่าไฟล์ที่ขออยู่ในโฟลเดอร์นี้จริง

ล้างข้อมูลทดลอง: หยุด API แล้วลบ `server/krathong.db*`

## 6. ตัวแปร environment

ทั้งหมดอ่านใน `server/server.mjs`

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `PORT` | `3026` | พอร์ตที่ Node ฟัง |
| `HOST` | `127.0.0.1` | interface ที่ฟัง ใน Docker ตั้งเป็น `0.0.0.0` แล้ว |
| `DB_PATH` | `server/krathong.db` | ไฟล์ SQLite ใน Docker คือ `/data/krathong.db` |
| `STATIC_DIR` | ไม่ตั้ง | โฟลเดอร์ `dist` ถ้าไม่ตั้ง server ตอบแค่ `/api/*` |
| `ADMIN_PASSWORD` | ไม่ตั้ง | รหัสหน้า admin **ถ้าไม่ตั้ง API admin จะปิดทั้งหมด** |
| `CLOSED` | ไม่ตั้ง | ตั้งค่าอะไรก็ได้ที่ไม่ว่าง = ปิดรับกระทงใหม่ (ดูหัวข้อ 9) |

> `CLOSED=0` ก็ถือว่า **ปิด** เพราะเป็น string ไม่ว่าง ถ้าจะเปิดงานให้ลบตัวแปรนี้ออก

ตัวเลขที่ฝังในโค้ด ปรับได้ที่ต้นไฟล์ `server/server.mjs`:

- `POSTS_PER_MINUTE = 6` จำนวนโพสต์ต่อนาทีต่อ IP
- `ADMIN_TRIES_PER_MINUTE = 5` จำนวนครั้งที่ใส่รหัส admin ผิดได้ต่อนาทีต่อ IP

## 7. API

ทุก response เป็น JSON และส่ง `Cache-Control: no-store`

| Method | Path | Auth | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/krathongs` | – | รายการกระทงทั้งหมด เรียงตามเวลา |
| `POST` | `/api/krathongs` | – | ลอยกระทงใหม่ |
| `GET` | `/api/admin` | Bearer | ตรวจรหัส admin |
| `DELETE` | `/api/krathongs/:id` | Bearer | ลบกระทง |

ตัวอย่าง:

```bash
# ลอยกระทง
curl -X POST http://127.0.0.1:3026/api/krathongs \
  -H 'Content-Type: application/json' \
  -d '{"name":"มะลิ","wish":"ขอให้สุขภาพแข็งแรง","color":"#ffd23f","kind":"classic"}'

# ดูทั้งหมด
curl http://127.0.0.1:3026/api/krathongs

# ลบ (admin)
curl -X DELETE http://127.0.0.1:3026/api/krathongs/<uuid> \
  -H "Authorization: Bearer $ADMIN_PASSWORD"
```

กติกาตรวจข้อมูลของ `POST`:

- `name` string ไม่ว่าง ยาวไม่เกิน 30
- `wish` string ไม่ว่าง ยาวไม่เกิน 80
- `color` รูปแบบ `#rrggbb`
- `kind` string ไม่เกิน 20 หรือไม่ส่งก็ได้ (หน้าเว็บจะแสดงเป็น `classic` ถ้าไม่รู้จัก)
- body ใหญ่ไม่เกิน 4 KB

รหัสสถานะ: `201` สำเร็จ, `400` ข้อมูลผิด, `403` ปิดงานแล้ว, `429` ส่งถี่เกิน, `401` รหัส admin ผิด

ตารางในฐานข้อมูล:

```sql
CREATE TABLE krathong (
  id TEXT PRIMARY KEY,     -- UUID
  name TEXT NOT NULL,
  wish TEXT NOT NULL,
  color TEXT NOT NULL,
  kind TEXT,
  createdAt TEXT NOT NULL  -- ISO 8601
);
```

server สร้างตารางให้เองตอนเริ่ม ไม่ต้องรัน migration

## 8. ปรับแต่ง

| อยากเปลี่ยน | แก้ที่ |
|---|---|
| ปี / ชื่องาน | `index.html` (`<title>`, `<h1>`) และ `src/credits.ts` |
| ชุดสีให้เลือก | `COLORS` ใน `src/main.ts` |
| แบบกระทง | `src/kinds.ts` เพิ่มฟังก์ชันวาด SVG แล้วใส่ใน `KINDS` |
| ฟอนต์ | ลิงก์ Google Fonts ใน `index.html` และ `font-family` ใน `src/style.css` |
| ความถี่การดึงข้อมูล | `POLL_MS` ใน `src/store.ts` |
| ความยาวชื่อ/คำอธิษฐาน | `maxlength` ใน `index.html` **และ** `str(..., 30/80)` ใน `server/server.mjs` ให้ตรงกัน |

เพิ่มกระทงแบบใหม่: ทุกแบบวาดใน `viewBox` 100×90 เส้นน้ำอยู่ราว y=58 ตัวอย่าง:

```ts
const lotus = (c: string) => `
  <ellipse cx="50" cy="58" rx="40" ry="10" fill="#2c6e35"/>
  <circle cx="50" cy="40" r="14" fill="${c}"/>
  <rect x="48" y="14" width="4" height="14" fill="#fff6d5"/>
  ${flame(50, 10)}`;

export const KINDS = {
  // ...แบบเดิม
  lotus: { label: 'ดอกบัว', draw: lotus },
} as const;
```

ชื่อ key (`lotus`) คือค่าที่เก็บในฐานข้อมูล ต้องยาวไม่เกิน 20 ตัวอักษร

## 9. เปิดงาน / ปิดงาน

โค้ดใน repo นี้อยู่ใน **สถานะปิดงาน** (งานจบแล้ว) มี 2 จุดที่ต้องแก้ให้ตรงกัน:

| จุด | ปิดงาน (ค่าปัจจุบัน) | เปิดงาน |
|---|---|---|
| Server: `CLOSED` ใน `compose.yml` | `CLOSED: "1"` → `POST` ได้ `403` | ลบบรรทัด `environment:` และ `CLOSED` ออก |
| Frontend: `main()` ใน `src/main.ts` | `document.body.classList.add('ended')` และเรียก `showCredits()` | ดูด้านล่าง |

เปิดงานฝั่ง frontend: ใน `src/main.ts` ฟังก์ชัน `main()`

1. ลบบรรทัด `document.body.classList.add('ended');`
2. เปลี่ยน `let creditsShown = isAdmin;` เป็น `let creditsShown = true;` เพื่อไม่ให้เครดิตขึ้น

ปิดงานเมื่องานจบ: ทำย้อนกลับ แล้ว build และ deploy ใหม่ (หัวข้อ 15) ข้อมูลเดิมยังอยู่ครบ และ `/admin` ยังใช้ลบได้ตามปกติ

## 10. รันด้วย Docker บนเครื่องตัวเอง

`compose.yml` ที่อยู่ใน repo ผูกพอร์ตกับ IP ของเครื่องหนึ่งโดยเฉพาะ ใช้กับเครื่องอื่นไม่ได้ ให้รันด้วย `docker run` แทน:

```bash
docker build -t loy-krathong .
docker volume create krathong-data
docker run --rm -p 127.0.0.1:8026:3026 \
  -v krathong-data:/data \
  -e ADMIN_PASSWORD=devpass \
  loy-krathong
```

เปิด http://127.0.0.1:8026

Dockerfile ทำอะไร:

1. stage `build`: `npm ci` แล้ว `npm run build` ได้ `dist/`
2. stage สุดท้าย: คัดลอกแค่ `server/` กับ `dist/` รันด้วย user `node` (ไม่ใช่ root) ฐานข้อมูลอยู่ที่ volume `/data`

## 11. Deploy ขึ้น VPS

ภาพรวม: VPS 1 เครื่อง รัน 2 container ผ่าน Docker Compose คือ `app` (โปรเจกต์นี้) และ `caddy` (HTTPS + reverse proxy) มีแค่ Caddy ที่เปิดพอร์ตสู่ภายนอก

### 11.1 เช่า VPS

ผู้ให้บริการไหนก็ได้ (DigitalOcean, Vultr, Linode, Hetzner, AWS Lightsail, ผู้ให้บริการในไทย ฯลฯ)

- OS: **Ubuntu 24.04 LTS**
- สเปก: 1 vCPU / 1 GB RAM / 20 GB disk พอ
- ตอนสร้าง ใส่ SSH public key ของคุณ (สร้างด้วย `ssh-keygen -t ed25519` ถ้ายังไม่มี)
- จด **IPv4** (และ **IPv6** ถ้ามี) ของเครื่องไว้ ใช้ตอนตั้ง DNS

> ถ้าผู้ให้บริการมี firewall ในหน้า console (security group) ให้เปิดขาเข้า TCP 22, 80, 443 และ UDP 443 (HTTP/3)

### 11.2 ตั้งค่าเครื่องเบื้องต้น

```bash
ssh root@203.0.113.10

# อัปเดตระบบ
apt update && apt upgrade -y

# สร้าง user สำหรับทำงาน (ไม่ใช้ root ตรง ๆ)
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable
```

ลอง login ด้วย `ssh deploy@203.0.113.10` ให้ได้ก่อน จากนั้นจะปิดการ login ด้วยรหัสผ่านก็ได้ โดยแก้ `/etc/ssh/sshd_config` ให้ `PasswordAuthentication no` แล้ว `sudo systemctl restart ssh`

> **ข้อควรรู้:** Docker เขียนกฎ iptables เองและ**ข้าม ufw** พอร์ตไหนที่ประกาศใน `ports:` จะเปิดสู่อินเทอร์เน็ตทันทีแม้ ufw จะไม่อนุญาต ด้วยเหตุนี้ compose ด้านล่างจึงไม่ประกาศ `ports:` ให้ `app` เลย

### 11.3 ติดตั้ง Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
exit   # ออกแล้ว ssh เข้าใหม่เพื่อให้กลุ่ม docker มีผล
```

```bash
ssh deploy@203.0.113.10
docker run --rm hello-world
docker compose version
```

### 11.4 ดึงโค้ด

```bash
sudo mkdir -p /opt/loy-krathong
sudo chown deploy:deploy /opt/loy-krathong
git clone https://github.com/<your-account>/loy-krathong.git /opt/loy-krathong
cd /opt/loy-krathong
```

### 11.5 ตั้งรหัส admin

```bash
echo "ADMIN_PASSWORD=$(openssl rand -base64 24)" > .env
chmod 600 .env
cat .env   # จดรหัสนี้ไว้ ใช้เข้า /admin
```

`.env` อยู่ใน `.gitignore` แล้ว จะไม่ถูก commit

### 11.6 สร้างไฟล์ compose สำหรับ production

สร้าง `compose.prod.yml` ที่ root ของโปรเจกต์:

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    env_file: .env
    # environment:
    #   CLOSED: "1"    # เปิดบรรทัดนี้เมื่อจบงาน (ดูหัวข้อ 9)
    volumes:
      - data:/data
    # ไม่มี ports: เข้าถึงได้เฉพาะจาก caddy ผ่าน network ภายใน

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data       # ใบรับรอง TLS (ห้ามลบ)
      - caddy_config:/config
    depends_on:
      - app

volumes:
  data:
  caddy_data:
  caddy_config:
```

และ `Caddyfile`:

```caddyfile
krathong.example.com {
	encode zstd gzip
	reverse_proxy app:3026
}

# ถ้าต้องการให้ www ชี้กลับมาที่โดเมนหลัก
www.krathong.example.com {
	redir https://krathong.example.com{uri} permanent
}
```

ยังไม่ต้อง `up` ตอนนี้ ไปตั้ง DNS ก่อน (หัวข้อ 12) เพราะ Caddy จะขอใบรับรองทันทีที่เริ่ม ถ้า DNS ยังไม่ชี้มาจะขอไม่ผ่าน และ Let's Encrypt มีเพดานจำนวนครั้งที่ขอพลาดได้

### 11.7 เริ่มระบบ

หลัง DNS ชี้มาที่เครื่องแล้ว:

```bash
cd /opt/loy-krathong
docker compose -f compose.prod.yml -p loy-krathong up -d --build
docker compose -f compose.prod.yml -p loy-krathong logs -f caddy
```

รอจนเห็น log ว่า `certificate obtained successfully` แล้วเปิด https://krathong.example.com

ตรวจจากเครื่องตัวเอง:

```bash
curl -I https://krathong.example.com
curl https://krathong.example.com/api/krathongs
```

`restart: unless-stopped` ทำให้ทั้งสอง container ขึ้นเองหลังรีบูตเครื่อง

## 12. ตั้งค่า DNS

### 12.1 ซื้อโดเมน

ซื้อจาก registrar ไหนก็ได้ เช่น Cloudflare Registrar, Namecheap, Porkbun หรือ registrar ในไทยสำหรับ `.co.th`/`.in.th` ถ้าจะใช้ DNS ของ Cloudflare ให้เปลี่ยน nameserver ที่ registrar เป็นของ Cloudflare ตามที่หน้า Cloudflare บอก (อาจใช้เวลาหลายชั่วโมง)

จะใช้โดเมนหลัก (`example.com`) หรือ subdomain (`krathong.example.com`) ก็ได้ ตัวอย่างทั้งหมดใช้ subdomain

### 12.2 เพิ่ม record

ในหน้าจัดการ DNS ของโดเมน:

| Type | Name | Value | TTL |
|---|---|---|---|
| `A` | `krathong` | `203.0.113.10` (IPv4 ของ VPS) | 300 หรือ Auto |
| `AAAA` | `krathong` | IPv6 ของ VPS | 300 หรือ Auto |
| `CNAME` | `www.krathong` | `krathong.example.com` | 300 หรือ Auto |

- `Name` ใส่แค่ส่วนหน้าโดเมน บางเจ้าใช้ `@` แทนโดเมนหลัก
- ใส่ `AAAA` **เฉพาะเมื่อ** VPS มี IPv6 ที่ใช้ได้จริง ถ้าใส่ IPv6 ที่ใช้ไม่ได้ Let's Encrypt อาจตรวจผ่าน IPv6 แล้วล้มเหลว
- `www` ไม่จำเป็น ถ้าไม่ใส่ก็ลบ block `www.` ออกจาก `Caddyfile`
- TTL ต่ำ (300 วินาที) ช่วยให้แก้ไขมีผลเร็วช่วงตั้งระบบ ตั้งให้สูงขึ้นทีหลังได้

### 12.3 ตรวจว่า DNS ชี้ถูก

```bash
dig +short krathong.example.com A
dig +short krathong.example.com AAAA
# หรือถามจาก resolver สาธารณะ
dig +short krathong.example.com @1.1.1.1
dig +short krathong.example.com @8.8.8.8
```

ต้องได้ IP ของ VPS ก่อนจึงไป `up` ในหัวข้อ 11.7 บน Windows ใช้ `nslookup krathong.example.com 1.1.1.1`

### 12.4 ถ้าใช้ Cloudflare

ตอนตั้งระบบครั้งแรก แนะนำให้ record เป็น **DNS only (เมฆสีเทา)** Caddy จะได้ขอใบรับรองตรง ๆ และ server เห็น IP จริงของผู้ใช้

ถ้าจะเปิด **Proxied (เมฆสีส้ม)** ภายหลัง:

- ตั้ง SSL/TLS mode เป็น **Full (strict)** ไม่งั้นจะเกิด redirect loop หรือไม่ได้เข้ารหัสช่วง Cloudflare → VPS
- server จะเห็น IP ของ Cloudflare แทน IP ผู้ใช้ ทำให้ rate limit นับรวมผู้ใช้หลายคนเป็น IP เดียว แก้โดยให้ Caddy เชื่อ header ของ Cloudflare ใส่ global options ไว้บนสุดของ `Caddyfile`:

  ```caddyfile
  {
  	servers {
  		trusted_proxies static <ใส่ช่วง IP จาก https://www.cloudflare.com/ips/>
  		client_ip_headers CF-Connecting-IP
  	}
  }
  ```

### 12.5 CAA record (ไม่บังคับ)

ล็อกให้ออกใบรับรองได้เฉพาะ Let's Encrypt:

| Type | Name | Value |
|---|---|---|
| `CAA` | `krathong` | `0 issue "letsencrypt.org"` |

ถ้าใช้ Cloudflare proxied ข้ามข้อนี้ไป เพราะ Cloudflare ใช้ CA อื่นด้วย

## 13. HTTPS ด้วย Caddy

Caddy จัดการให้เองทั้งหมด: ขอใบรับรองจาก Let's Encrypt, redirect HTTP → HTTPS, ต่ออายุก่อนหมด เงื่อนไขที่ต้องครบ:

1. DNS ของโดเมนชี้มาที่ VPS
2. พอร์ต 80 และ 443 เปิดจากอินเทอร์เน็ต (ทั้ง ufw และ firewall ของผู้ให้บริการ)
3. ไม่มีโปรแกรมอื่นจับพอร์ต 80/443 อยู่ (เช็กด้วย `sudo ss -tlnp | grep -E ':80|:443'`)

ใบรับรองเก็บใน volume `caddy_data` อย่าลบ volume นี้ ถ้าลบ Caddy ต้องขอใหม่และอาจชนเพดานของ Let's Encrypt

**มี reverse proxy อยู่แล้ว (nginx, Traefik, Caddy บน host)?** ไม่ต้องใช้ service `caddy` ใน compose ให้เปิดพอร์ต `app` เฉพาะ localhost แล้วชี้ proxy ไปที่นั่น:

```yaml
services:
  app:
    # ...
    ports:
      - "127.0.0.1:8026:3026"
```

ตัวอย่าง nginx (ออกใบรับรองด้วย `certbot --nginx`):

```nginx
server {
    server_name krathong.example.com;
    location / {
        proxy_pass http://127.0.0.1:8026;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;   # เขียนทับ ไม่ใช่ต่อท้าย
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> ใช้ `$remote_addr` ไม่ใช่ `$proxy_add_x_forwarded_for` เพราะ server อ่าน IP ตัวแรกใน `X-Forwarded-For` ถ้าต่อท้าย ผู้ใช้จะปลอม IP เพื่อหลบ rate limit ได้ (รายละเอียดในหัวข้อ 16)

## 14. หน้า Admin

1. เปิด `https://krathong.example.com/admin`
2. ใส่รหัสจาก `.env` (`ADMIN_PASSWORD`)
3. แตะกระทงที่ต้องการ แล้วกดปุ่มลบ

รหัสถูกเก็บใน `sessionStorage` ของแท็บนั้น ปิดแท็บแล้วต้องใส่ใหม่ ใส่ผิดเกิน 5 ครั้งต่อนาทีจะถูกพักไว้ 1 นาที

เปลี่ยนรหัส: แก้ `.env` แล้ว `docker compose -f compose.prod.yml -p loy-krathong up -d` (compose จะสร้าง container ใหม่เมื่อ env เปลี่ยน)

## 15. อัปเดต สำรอง และกู้ข้อมูล

ตั้ง alias ไว้พิมพ์สั้นลง (ใส่ใน `~/.bashrc` ของ VPS):

```bash
alias dc='docker compose -f /opt/loy-krathong/compose.prod.yml -p loy-krathong'
```

### อัปเดตโค้ด

```bash
cd /opt/loy-krathong
git pull
dc up -d --build
```

ข้อมูลอยู่ใน volume จึงไม่หายเวลาสร้าง container ใหม่

### ดู log และสถานะ

```bash
dc ps
dc logs -f app
dc logs -f caddy
```

### สำรองฐานข้อมูล

ใช้ `VACUUM INTO` ของ SQLite ได้สำเนาที่สอดคล้องกันโดยไม่ต้องหยุดระบบ:

```bash
dc exec app node --disable-warning=ExperimentalWarning -e \
  "new (require('node:sqlite').DatabaseSync)('/data/krathong.db').exec(\"VACUUM INTO '/data/backup.db'\")"
dc cp app:/data/backup.db ./krathong-$(date +%F).db
dc exec app rm /data/backup.db
```

ดึงไฟล์กลับเครื่องตัวเอง:

```bash
scp deploy@203.0.113.10:/opt/loy-krathong/krathong-*.db .
```

> อย่าคัดลอก `krathong.db` ตรง ๆ ขณะระบบทำงาน ฐานข้อมูลใช้โหมด WAL ข้อมูลล่าสุดอาจยังอยู่ในไฟล์ `-wal`

### กู้ข้อมูล

```bash
dc stop app
dc cp ./krathong-2026-11-25.db app:/data/krathong.db
dc exec -u root app sh -c 'rm -f /data/krathong.db-wal /data/krathong.db-shm; chown node:node /data/krathong.db' 2>/dev/null || true
dc start app
```

ถ้า `exec` ไม่ได้เพราะ container หยุดอยู่ ให้ใช้ container ชั่วคราวแตะ volume แทน:

```bash
docker run --rm -v loy-krathong_data:/data -v "$PWD":/backup alpine sh -c \
  'cp /backup/krathong-2026-11-25.db /data/krathong.db && rm -f /data/krathong.db-wal /data/krathong.db-shm && chown 1000:1000 /data/krathong.db'
dc start app
```

(ชื่อ volume คือ `<project>_data` ในตัวอย่างนี้คือ `loy-krathong_data` ดูได้จาก `docker volume ls`)

### ส่งออกเป็น JSON

```bash
curl -s https://krathong.example.com/api/krathongs > krathongs.json
```

## 16. ความปลอดภัย

- **IP สำหรับ rate limit มาจาก `X-Forwarded-For`** server เชื่อค่าตัวแรกของ header นี้ ซึ่งปลอดภัยเมื่อ (1) พอร์ตของ `app` เข้าถึงได้จาก proxy เท่านั้น และ (2) proxy **เขียนทับ** header นี้ด้วย IP จริง Caddy 2.5 ขึ้นไปทำแบบนี้เป็นค่าเริ่มต้น ถ้าเปิดพอร์ต `app` สู่อินเทอร์เน็ตตรง ๆ ใครก็ใส่ header ปลอมเพื่อหลบ rate limit ได้
- **ข้อความผู้ใช้แสดงผลด้วย `textContent`** ไม่ใช่ `innerHTML` จึงไม่เกิด XSS จากชื่อหรือคำอธิษฐาน ถ้าแก้โค้ดแสดงผล ให้รักษาหลักนี้ไว้
- **รหัส admin** เทียบด้วย `timingSafeEqual` บน SHA-256 และจำกัดจำนวนครั้งที่ผิด ใช้รหัสยาวแบบสุ่ม (`openssl rand`) อย่าใช้รหัสที่เดาได้
- **ถ้าไม่ตั้ง `ADMIN_PASSWORD`** API admin จะปิดสนิท
- **rate limit เก็บในหน่วยความจำ** รีสตาร์ตแล้วนับใหม่ และใช้ได้กับ container เดียวเท่านั้น ถ้าจะ scale หลาย instance ต้องย้ายไปเก็บที่อื่น (เช่น Redis) และย้ายฐานข้อมูลออกจาก SQLite ด้วย
- ไม่มีการกรองคำหยาบ ใช้หน้า `/admin` ลบเอา หรือเพิ่มตัวกรองใน handler `POST` ของ `server/server.mjs`

## 17. แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `No such built-in module: node:sqlite` | Node เก่ากว่า 22.13 อัปเกรด Node |
| `npm run dev` แล้วหน้าเว็บขึ้น "กำลังโหลด…" ค้าง | ยังไม่ได้รัน `npm run api` หรือ API ไม่ได้อยู่ที่พอร์ต 3026 |
| ลอยแล้วได้ "ปิดรับลอยกระทงแล้ว" (403) | ตั้ง `CLOSED` ไว้ ลบออกแล้ว `up -d` ใหม่ (หัวข้อ 9) |
| หน้าแรกเป็นเครดิต ไม่มีปุ่มลอย | frontend อยู่ในโหมดปิดงาน แก้ `src/main.ts` ตามหัวข้อ 9 |
| `docker compose up` แจ้ง `env file .env not found` | ยังไม่ได้สร้าง `.env` (หัวข้อ 11.5) ถ้าไม่ต้องการ admin ให้สร้างไฟล์เปล่าด้วย `touch .env` |
| Caddy log: `challenge failed` / `timeout during connect` | DNS ยังไม่ชี้มา, พอร์ต 80/443 ถูกปิด หรือมี `AAAA` ที่ IPv6 ใช้ไม่ได้ ตรวจด้วย `dig` และ firewall |
| Caddy log: `too many failed authorizations` | ชนเพดานของ Let's Encrypt รอราว 1 ชั่วโมง แก้ DNS/firewall ให้ถูกก่อนลองใหม่ |
| เว็บขึ้น `ERR_TOO_MANY_REDIRECTS` | ใช้ Cloudflare proxied กับ SSL mode "Flexible" เปลี่ยนเป็น Full (strict) |
| `SQLITE_CANTOPEN` / `readonly database` | user `node` ไม่มีสิทธิ์เขียน `/data` เช็กเจ้าของไฟล์ใน volume ต้องเป็น uid 1000 |
| ทุกคนโดน "ลอยถี่เกินไป" พร้อมกัน | server เห็นทุกคนเป็น IP เดียว (proxy ไม่ส่ง `X-Forwarded-For` หรือใช้ Cloudflare proxied) ดูหัวข้อ 12.4 และ 13 |

---

## License

ยังไม่ได้ระบุ license ถ้าจะเผยแพร่ให้คนอื่นนำไปใช้ต่อ ให้เพิ่มไฟล์ `LICENSE` (เช่น MIT) ก่อน
