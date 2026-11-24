# Online Loy Krathong 🪷

A small web app for floating a krathong online. Visitors enter a name and a wish, pick a krathong style and a color, then float it. Everyone's krathongs drift down the same river and show up for others within a few seconds. When the event ends, the home page turns into end credits that scroll through every name and wish.

It's meant as a starter project small enough to read in an afternoon. The frontend uses no framework, the server has no dependencies, and the database is a single SQLite file.

This guide goes end to end: running it locally, customizing it, building it with Docker, renting a VPS, setting up DNS, enabling HTTPS, and keeping it running afterwards. All examples use the placeholder domain `krathong.example.com` and the placeholder IP `203.0.113.10`. Replace them with your own.

---

## Contents

1. [Features](#1-features)
2. [Architecture](#2-architecture)
3. [Project layout](#3-project-layout)
4. [Requirements](#4-requirements)
5. [Run locally](#5-run-locally)
6. [Environment variables](#6-environment-variables)
7. [API](#7-api)
8. [Customization](#8-customization)
9. [Opening and closing the event](#9-opening-and-closing-the-event)
10. [Run with Docker locally](#10-run-with-docker-locally)
11. [Deploy to a VPS](#11-deploy-to-a-vps)
12. [DNS setup](#12-dns-setup)
13. [HTTPS with Caddy](#13-https-with-caddy)
14. [Admin page](#14-admin-page)
15. [Updates, backups and restores](#15-updates-backups-and-restores)
16. [Security](#16-security)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Features

- Float a krathong with a name (up to 30 characters) and a wish (up to 80 characters)
- 5 krathong styles drawn in plain SVG: banana leaf (ใบตอง), beer, documents, bread, overtime coffee, in 5 colors
- Krathongs float in lanes with perspective and water effects. Tap one to read its wish
- Polls for new krathongs every 5 seconds (paused while the tab is hidden)
- Rate limit of 6 posts per minute per IP
- `/admin` page for deleting inappropriate krathongs, with the password checked server-side
- Closed mode: the server rejects new krathongs and the home page plays the end credits

The UI text is in Thai.

## 2. Architecture

```
 Browser
     │  HTTPS :443
     ▼
 ┌──────────────┐   http://app:3026   ┌──────────────────────────────┐
 │ Caddy        │ ──────────────────▶ │ Node (server/server.mjs)     │
 │ - automatic  │                     │ - /api/*  → JSON API         │
 │   TLS        │                     │ - else    → files in dist/   │
 │ - reverse    │                     │ - SQLite (node:sqlite)       │
 │   proxy      │                     └──────────────┬───────────────┘
 └──────────────┘                                    │
                                              /data/krathong.db
                                              (docker volume)
```

- **Frontend**: Vite + TypeScript, no framework. Builds to static files in `dist/`.
- **Backend**: a single file, `server/server.mjs`, using only Node built-ins (`node:http`, `node:sqlite`, `node:crypto`). It needs Node 22.13 or newer, the first version where `node:sqlite` works without a flag.
- **Production**: one container serves both the API and the frontend, with Caddy in front for HTTPS.
- **Development**: Vite serves the frontend on port 5173 and proxies `/api` to Node on port 3026.

## 3. Project layout

```
.
├── index.html          # HTML shell, form, Mitr font
├── src/
│   ├── main.ts         # entry point: river, stars, form, lanes, admin
│   ├── store.ts        # API calls (GET/POST/DELETE) and polling
│   ├── kinds.ts        # SVG drawing for each krathong style
│   ├── credits.ts      # end credits shown after the event
│   └── style.css
├── server/
│   └── server.mjs      # API + static file server + SQLite
├── vite.config.ts      # proxies /api to 127.0.0.1:3026 in dev
├── Dockerfile          # multi-stage: build with Node, run with Node
├── compose.yml         # sample compose file (read section 11 first)
└── package.json
```

## 4. Requirements

| For | You need |
|---|---|
| Local development | Node.js **22.13+** with npm, git |
| Running with Docker | Docker Engine + Docker Compose v2 |
| Production | One VPS (1 vCPU / 1 GB RAM is enough) and a domain |

Check versions:

```bash
node -v            # must be v22.13.0 or newer
docker compose version
```

## 5. Run locally

```bash
git clone https://github.com/<your-account>/loy-krathong.git
cd loy-krathong
npm install
```

Open two terminals:

```bash
# terminal 1: API on 127.0.0.1:3026, database at server/krathong.db
npm run api

# terminal 2: frontend on http://localhost:5173
npm run dev
```

To try the admin page in dev, give the API a password:

```bash
ADMIN_PASSWORD=devpass npm run api
```

Then open http://localhost:5173/admin

Other commands:

```bash
npm run build     # type-check (tsc), then build into dist/
npm run preview   # preview the build with vite
```

To have Node serve the build the same way production does:

```bash
npm run build
STATIC_DIR="$PWD/dist" npm run api   # open http://127.0.0.1:3026
```

> `STATIC_DIR` must be an absolute path. The server uses it to check that requested files are inside that folder.

To wipe test data, stop the API and delete `server/krathong.db*`.

## 6. Environment variables

All of these are read in `server/server.mjs`.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3026` | Port Node listens on |
| `HOST` | `127.0.0.1` | Interface to listen on. The Docker image sets `0.0.0.0` |
| `DB_PATH` | `server/krathong.db` | SQLite file. In Docker it's `/data/krathong.db` |
| `STATIC_DIR` | unset | The `dist` folder. If unset, the server only answers `/api/*` |
| `ADMIN_PASSWORD` | unset | Admin password. **If unset, the admin API is disabled entirely** |
| `CLOSED` | unset | Any non-empty value stops new krathongs (see section 9) |

> `CLOSED=0` also counts as **closed**, because it's a non-empty string. To open the event, remove the variable.

Limits hard-coded at the top of `server/server.mjs`:

- `POSTS_PER_MINUTE = 6`: posts per minute per IP
- `ADMIN_TRIES_PER_MINUTE = 5`: wrong admin passwords allowed per minute per IP

## 7. API

Every response is JSON with `Cache-Control: no-store`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/krathongs` | – | All krathongs, oldest first |
| `POST` | `/api/krathongs` | – | Float a new krathong |
| `GET` | `/api/admin` | Bearer | Check the admin password |
| `DELETE` | `/api/krathongs/:id` | Bearer | Delete a krathong |

Examples:

```bash
# float a krathong
curl -X POST http://127.0.0.1:3026/api/krathongs \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mali","wish":"Good health for everyone","color":"#ffd23f","kind":"classic"}'

# list all
curl http://127.0.0.1:3026/api/krathongs

# delete (admin)
curl -X DELETE http://127.0.0.1:3026/api/krathongs/<uuid> \
  -H "Authorization: Bearer $ADMIN_PASSWORD"
```

`POST` validation:

- `name`: non-empty string, at most 30 characters
- `wish`: non-empty string, at most 80 characters
- `color`: `#rrggbb`
- `kind`: string of at most 20 characters, or omitted (the frontend falls back to `classic` for unknown kinds)
- Body at most 4 KB

Status codes: `201` created, `400` invalid input, `403` event closed, `429` too many posts, `401` wrong admin password.

Database table:

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

The server creates the table on startup. There are no migrations to run.

## 8. Customization

| To change | Edit |
|---|---|
| Year / event name | `index.html` (`<title>`, `<h1>`) and `src/credits.ts` |
| Color choices | `COLORS` in `src/main.ts` |
| Krathong styles | `src/kinds.ts`: add an SVG drawing function and register it in `KINDS` |
| Font | Google Fonts link in `index.html` and `font-family` in `src/style.css` |
| Polling interval | `POLL_MS` in `src/store.ts` |
| Name / wish length | `maxlength` in `index.html` **and** `str(..., 30/80)` in `server/server.mjs`. Keep them in sync |

Adding a krathong style: every drawing uses a 100×90 `viewBox` with the waterline near y=58. For example:

```ts
const lotus = (c: string) => `
  <ellipse cx="50" cy="58" rx="40" ry="10" fill="#2c6e35"/>
  <circle cx="50" cy="40" r="14" fill="${c}"/>
  <rect x="48" y="14" width="4" height="14" fill="#fff6d5"/>
  ${flame(50, 10)}`;

export const KINDS = {
  // ...existing styles
  lotus: { label: 'ดอกบัว', draw: lotus },
} as const;
```

The key (`lotus`) is what gets stored in the database, so keep it to 20 characters or fewer.

## 9. Opening and closing the event

The code in this repo is in **closed mode** (the event is over). Two places have to agree:

| Where | Closed (current) | Open |
|---|---|---|
| Server: `CLOSED` in `compose.yml` | `CLOSED: "1"`, so `POST` returns `403` | Remove the `environment:` and `CLOSED` lines |
| Frontend: `main()` in `src/main.ts` | Calls `document.body.classList.add('ended')` and `showCredits()` | See below |

To open the frontend, in `main()` in `src/main.ts`:

1. Delete the line `document.body.classList.add('ended');`
2. Change `let creditsShown = isAdmin;` to `let creditsShown = true;` so the credits never start

To close it again when the event ends, reverse both changes, then rebuild and redeploy (section 15). Existing data stays, and `/admin` still works for deleting.

## 10. Run with Docker locally

The `compose.yml` in this repo binds the port to one specific host's IP, so it won't work on other machines. Use `docker run` instead:

```bash
docker build -t loy-krathong .
docker volume create krathong-data
docker run --rm -p 127.0.0.1:8026:3026 \
  -v krathong-data:/data \
  -e ADMIN_PASSWORD=devpass \
  loy-krathong
```

Open http://127.0.0.1:8026

What the Dockerfile does:

1. `build` stage: `npm ci`, then `npm run build`, producing `dist/`
2. Final stage: copies only `server/` and `dist/` and runs as the `node` user (not root). The database lives in the `/data` volume

## 11. Deploy to a VPS

Overview: one VPS running two containers with Docker Compose: `app` (this project) and `caddy` (HTTPS and reverse proxy). Only Caddy is exposed to the internet.

### 11.1 Rent a VPS

Any provider works (DigitalOcean, Vultr, Linode, Hetzner, AWS Lightsail, a local provider, and so on).

- OS: **Ubuntu 24.04 LTS**
- Size: 1 vCPU / 1 GB RAM / 20 GB disk is enough
- Add your SSH public key when creating it (generate one with `ssh-keygen -t ed25519` if you don't have one)
- Note the machine's **IPv4** address (and **IPv6** if it has one). You'll need them for DNS

> If the provider has a firewall in its console (security groups), allow inbound TCP 22, 80, 443 and UDP 443 (HTTP/3).

### 11.2 Basic server setup

```bash
ssh root@203.0.113.10

# update the system
apt update && apt upgrade -y

# create a working user instead of using root directly
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

Make sure `ssh deploy@203.0.113.10` works first. After that you can turn off password logins by setting `PasswordAuthentication no` in `/etc/ssh/sshd_config` and running `sudo systemctl restart ssh`.

> **Note:** Docker writes its own iptables rules and **bypasses ufw**. Any port listed under `ports:` is open to the internet even if ufw doesn't allow it. That's why the compose file below gives `app` no `ports:` at all.

### 11.3 Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
exit   # log out and back in so the docker group takes effect
```

```bash
ssh deploy@203.0.113.10
docker run --rm hello-world
docker compose version
```

### 11.4 Get the code

```bash
sudo mkdir -p /opt/loy-krathong
sudo chown deploy:deploy /opt/loy-krathong
git clone https://github.com/<your-account>/loy-krathong.git /opt/loy-krathong
cd /opt/loy-krathong
```

### 11.5 Set the admin password

```bash
echo "ADMIN_PASSWORD=$(openssl rand -base64 24)" > .env
chmod 600 .env
cat .env   # save this password; you'll use it on /admin
```

`.env` is already in `.gitignore`, so it won't be committed.

### 11.6 Create a production compose file

Create `compose.prod.yml` in the project root:

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    env_file: .env
    # environment:
    #   CLOSED: "1"    # uncomment when the event ends (see section 9)
    volumes:
      - data:/data
    # no ports: only reachable from caddy over the internal network

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data       # TLS certificates (don't delete)
      - caddy_config:/config
    depends_on:
      - app

volumes:
  data:
  caddy_data:
  caddy_config:
```

And a `Caddyfile`:

```caddyfile
krathong.example.com {
	encode zstd gzip
	reverse_proxy app:3026
}

# optional: redirect www to the main domain
www.krathong.example.com {
	redir https://krathong.example.com{uri} permanent
}
```

Don't run `up` yet. Set up DNS first (section 12). Caddy requests a certificate as soon as it starts. If DNS doesn't point at the server yet, the request fails, and Let's Encrypt limits how many failed attempts you get.

### 11.7 Start it

Once DNS points at the server:

```bash
cd /opt/loy-krathong
docker compose -f compose.prod.yml -p loy-krathong up -d --build
docker compose -f compose.prod.yml -p loy-krathong logs -f caddy
```

Wait for `certificate obtained successfully` in the log, then open https://krathong.example.com

Check from your own machine:

```bash
curl -I https://krathong.example.com
curl https://krathong.example.com/api/krathongs
```

`restart: unless-stopped` brings both containers back up after a reboot.

## 12. DNS setup

### 12.1 Get a domain

Any registrar works, for example Cloudflare Registrar, Namecheap or Porkbun. To use Cloudflare DNS with a domain registered elsewhere, change the nameservers at your registrar to the ones Cloudflare gives you (this can take several hours).

You can use the apex domain (`example.com`) or a subdomain (`krathong.example.com`). The examples here use a subdomain.

### 12.2 Add records

In your domain's DNS settings:

| Type | Name | Value | TTL |
|---|---|---|---|
| `A` | `krathong` | `203.0.113.10` (the VPS IPv4) | 300 or Auto |
| `AAAA` | `krathong` | The VPS IPv6 | 300 or Auto |
| `CNAME` | `www.krathong` | `krathong.example.com` | 300 or Auto |

- `Name` is only the part before your domain. Some providers use `@` for the apex
- Add `AAAA` **only if** the VPS has working IPv6. A broken IPv6 address can make Let's Encrypt validate over IPv6 and fail
- `www` is optional. If you skip it, remove the `www.` block from the `Caddyfile`
- A low TTL (300 seconds) makes changes take effect quickly during setup. You can raise it later

### 12.3 Check DNS

```bash
dig +short krathong.example.com A
dig +short krathong.example.com AAAA
# or ask public resolvers
dig +short krathong.example.com @1.1.1.1
dig +short krathong.example.com @8.8.8.8
```

You should get the VPS IP before running `up` in section 11.7. On Windows, use `nslookup krathong.example.com 1.1.1.1`.

### 12.4 If you use Cloudflare

For the first setup, keep the record as **DNS only (grey cloud)**. Caddy can then get its certificate directly, and the server sees real client IPs.

If you switch to **Proxied (orange cloud)** later:

- Set the SSL/TLS mode to **Full (strict)**. Otherwise you'll get a redirect loop, or traffic between Cloudflare and the VPS won't be encrypted
- The server will see Cloudflare's IPs instead of your visitors', so the rate limit lumps many visitors into one IP. Fix this by having Caddy trust Cloudflare's header. Put these global options at the top of the `Caddyfile`:

  ```caddyfile
  {
  	servers {
  		trusted_proxies static <IP ranges from https://www.cloudflare.com/ips/>
  		client_ip_headers CF-Connecting-IP
  	}
  }
  ```

### 12.5 CAA record (optional)

Allow only Let's Encrypt to issue certificates for the domain:

| Type | Name | Value |
|---|---|---|
| `CAA` | `krathong` | `0 issue "letsencrypt.org"` |

Skip this if you use Cloudflare proxied mode, since Cloudflare also uses other CAs.

## 13. HTTPS with Caddy

Caddy handles all of it: it gets a certificate from Let's Encrypt, redirects HTTP to HTTPS, and renews before expiry. It needs:

1. The domain's DNS pointing at the VPS
2. Ports 80 and 443 open from the internet (in both ufw and the provider's firewall)
3. Nothing else listening on 80/443 (check with `sudo ss -tlnp | grep -E ':80|:443'`)

Certificates are stored in the `caddy_data` volume. Don't delete it, or Caddy has to request new ones and may hit Let's Encrypt's rate limits.

**Already have a reverse proxy (nginx, Traefik, Caddy on the host)?** Skip the `caddy` service. Publish the `app` port on localhost only and point your proxy at it:

```yaml
services:
  app:
    # ...
    ports:
      - "127.0.0.1:8026:3026"
```

nginx example (get a certificate with `certbot --nginx`):

```nginx
server {
    server_name krathong.example.com;
    location / {
        proxy_pass http://127.0.0.1:8026;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;   # overwrite, don't append
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> Use `$remote_addr`, not `$proxy_add_x_forwarded_for`. The server reads the first IP in `X-Forwarded-For`, so if the proxy appends, clients can spoof their IP to dodge the rate limit (see section 16).

## 14. Admin page

1. Open `https://krathong.example.com/admin`
2. Enter the password from `.env` (`ADMIN_PASSWORD`)
3. Tap a krathong, then press its delete button

The password is kept in that tab's `sessionStorage`, so you'll need to enter it again after closing the tab. More than 5 wrong attempts in a minute locks you out for a minute.

To change the password, edit `.env` and run `docker compose -f compose.prod.yml -p loy-krathong up -d`. Compose recreates the container when its env changes.

## 15. Updates, backups and restores

An alias saves typing (put it in `~/.bashrc` on the VPS):

```bash
alias dc='docker compose -f /opt/loy-krathong/compose.prod.yml -p loy-krathong'
```

### Update the code

```bash
cd /opt/loy-krathong
git pull
dc up -d --build
```

Data lives in a volume, so it survives the container being rebuilt.

### Logs and status

```bash
dc ps
dc logs -f app
dc logs -f caddy
```

### Back up the database

SQLite's `VACUUM INTO` produces a consistent copy without stopping the app:

```bash
dc exec app node --disable-warning=ExperimentalWarning -e \
  "new (require('node:sqlite').DatabaseSync)('/data/krathong.db').exec(\"VACUUM INTO '/data/backup.db'\")"
dc cp app:/data/backup.db ./krathong-$(date +%F).db
dc exec app rm /data/backup.db
```

Copy it to your own machine:

```bash
scp deploy@203.0.113.10:/opt/loy-krathong/krathong-*.db .
```

> Don't copy `krathong.db` directly while the app is running. The database uses WAL mode, so recent writes may still be in the `-wal` file.

### Restore

Stop the app, then write the backup into the volume with a throwaway container:

```bash
dc stop app
docker run --rm -v loy-krathong_data:/data -v "$PWD":/backup alpine sh -c \
  'cp /backup/krathong-2026-11-25.db /data/krathong.db && rm -f /data/krathong.db-wal /data/krathong.db-shm && chown 1000:1000 /data/krathong.db'
dc start app
```

The volume is named `<project>_data`, here `loy-krathong_data`. Check with `docker volume ls`.

### Export as JSON

```bash
curl -s https://krathong.example.com/api/krathongs > krathongs.json
```

## 16. Security

- **The rate-limit IP comes from `X-Forwarded-For`.** The server trusts the first value in that header. That's safe only when (1) the `app` port is reachable from the proxy alone, and (2) the proxy **overwrites** the header with the real client IP. Caddy 2.5+ does this by default. If you expose the `app` port directly to the internet, anyone can send a fake header and bypass the rate limit.
- **User text is rendered with `textContent`**, never `innerHTML`, so names and wishes can't inject HTML. Keep it that way if you change the rendering code.
- **The admin password** is compared with `timingSafeEqual` over SHA-256 hashes, and wrong attempts are rate-limited. Use a long random password (`openssl rand`), not something guessable.
- **Without `ADMIN_PASSWORD`**, the admin API is fully disabled.
- **Rate limits live in memory.** They reset on restart and only work for a single container. Scaling to several instances would mean moving them somewhere shared (such as Redis) and moving off SQLite too.
- There's no profanity filter. Delete through `/admin`, or add a filter to the `POST` handler in `server/server.mjs`.

## 17. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `No such built-in module: node:sqlite` | Node is older than 22.13. Upgrade Node |
| With `npm run dev`, the page stays on "กำลังโหลด…" (loading) | `npm run api` isn't running, or the API isn't on port 3026 |
| Floating fails with "ปิดรับลอยกระทงแล้ว" (403) | `CLOSED` is set. Remove it and run `up -d` again (section 9) |
| The home page shows credits and no float button | The frontend is in closed mode. Edit `src/main.ts` as in section 9 |
| `docker compose up` says `env file .env not found` | Create `.env` (section 11.5). If you don't want admin, create an empty one with `touch .env` |
| Caddy log: `challenge failed` / `timeout during connect` | DNS doesn't point here yet, ports 80/443 are blocked, or there's an `AAAA` record with broken IPv6. Check with `dig` and your firewall |
| Caddy log: `too many failed authorizations` | You hit Let's Encrypt's rate limit. Wait about an hour and fix DNS/firewall before retrying |
| Browser shows `ERR_TOO_MANY_REDIRECTS` | Cloudflare proxied with SSL mode "Flexible". Switch to Full (strict) |
| `SQLITE_CANTOPEN` / `readonly database` | The `node` user can't write to `/data`. Files in the volume must be owned by uid 1000 |
| Everyone gets "ลอยถี่เกินไป" (too many posts) at once | The server sees everyone as one IP: the proxy doesn't send `X-Forwarded-For`, or Cloudflare is proxying. See sections 12.4 and 13 |

---

## License

No license has been chosen yet. If you want others to reuse this project, add a `LICENSE` file (for example MIT) first.
