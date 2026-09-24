# Local servers (this machine, 2026-09-24)

What was left running after E5, and how to restart it. Machine-specific: the scratch path below only exists
here. From a fresh checkout, follow `README.md` instead.

```bash
SCR=/private/tmp/claude-502/-Users-jasonojulari-Library-Application-Support-Claude-scratch-workspaces-f2d429e2-a153-43bf-98dd-ec06d0252e44-02812373-138d-4a58-874b-33e46fa50871-scratch-2026-09-24-81d82a/75fde853-066f-4a74-b89a-84b84f9a3d78/scratchpad
ROOT="/Users/jasonojulari/Desktop/freelance/crown-barbershop"
PGBIN=/opt/homebrew/opt/postgresql@14/bin
```

| Service | Address | PID (at hand-off) | Log | State |
|---|---|---|---|---|
| Postgres 14 (throwaway cluster, trust auth, TCP only) | 127.0.0.1:5544 | 64967 | `$SCR/pg/server.log` | databases `crown` (dev) and `crown_test` (pytest) |
| API (uvicorn, 1 worker, scheduler on) | http://127.0.0.1:8000 | 72995 | `$SCR/api.log` | real clock, `DEMO_MODE=1` (SMS dry run), demo data freshly reset |
| Web (`next start`, production build with `NEXT_PUBLIC_DEMO_MODE=1`) | http://127.0.0.1:3000 | 71836 (listener; npm parent 71813 in `$SCR/web.pid`) | `$SCR/web.log` | site + `/admin` (demo login `owner@crownbarbershop.ca` / `crown2026`) |

`Backend/.env` (untracked, not shown here) holds this machine's `DATABASE_URL`, a locally generated
`JWT_SECRET`, `DEMO_MODE=1`, `FRONTEND_ORIGIN` and a fake shop number for `CROWN_SHOP_SMS_TO`.

## Start / stop

```bash
# Postgres
$PGBIN/pg_ctl -D $SCR/pg/data -o "-p 5544 -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -l $SCR/pg/server.log -w start
$PGBIN/pg_ctl -D $SCR/pg/data -m fast stop

# API
kill $(lsof -nP -tiTCP:8000 -sTCP:LISTEN)
cd "$ROOT/Backend" && nohup .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 > $SCR/api.log 2>&1 &

# Web (rebuild only after code or NEXT_PUBLIC_* changes)
kill $(lsof -nP -tiTCP:3000 -sTCP:LISTEN)
cd "$ROOT/Frontend" && NEXT_PUBLIC_DEMO_MODE=1 npm run build
cd "$ROOT/Frontend" && NEXT_PUBLIC_DEMO_MODE=1 nohup npm run start > $SCR/web.log 2>&1 & echo $! > $SCR/web.pid
```

Demo data back to the design's samples: Admin > Settings > "Reset demo data", or `.venv/bin/python seed.py --demo`
(the seed only replaces the sample rows; the reset wipes everything else too).

Fidelity runs need the API on the frozen clock; see `fidelity/README.md`. Restart it as above afterwards.
