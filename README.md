# Yantraform

A self-hosted web dashboard for managing WireGuard VPN servers. Yantraform provides a clean interface to configure WireGuard interfaces, manage peers and agents, monitor traffic, handle DNS records, and manage firewall rules — all from the browser.

Yantraform distinguishes between two types of WireGuard members:

- **Peers** — Devices that access the VPN (phones, laptops, desktops). They receive a WireGuard config or QR code and connect as consumers.
- **Agents** — Servers that join the VPN and have `yantra-agent` installed. They provide remote system monitoring (CPU, memory, disk, load) and command execution from the dashboard.

## Features

- **Dashboard** — Real-time overview of server status, connected peers/agents, and aggregate traffic with historical charts
- **Peer Management** — Add, edit, enable/disable, and delete VPN peers with automatic IP allocation, key generation, QR codes, and config downloads
- **Agent Management** — Dedicated view for managing agents with `yantra-agent` installation, remote system monitoring (CPU, memory, disk, load), and command execution, supporting amd64, arm64, and armv7 architectures
- **DNS Management** — Integrated dnsmasq setup for custom DNS records within the VPN, with automatic hostname resolution
- **Firewall Management** — Detect and manage firewall rules across ufw, firewalld, iptables, and nftables
- **Traffic Statistics** — Per-peer/agent and global traffic charts with selectable time ranges, backed by 30-day historical data
- **Server Controls** — Start, stop, and restart the WireGuard interface from the UI
- **Authentication** — JWT-based admin login with password management
- **Dark Mode** — Light/dark theme toggle with system preference detection
- **LAN/WAN Awareness** — Peers and agents can be configured for local or remote network access with separate endpoint handling
- **Guided Setup** — First-run wizard if WireGuard is not installed or configured

## Tech Stack

| Layer       | Technology                                                   |
| ----------- | ------------------------------------------------------------ |
| Framework   | [TanStack Start](https://tanstack.com/start) (React 19 SSR) |
| Routing     | [TanStack Router](https://tanstack.com/router)               |
| Server      | [Nitro](https://nitro.build/) (Node.js preset)              |
| UI          | [Radix UI](https://www.radix-ui.com/) + [Tailwind CSS](https://tailwindcss.com/) |
| Charts      | [Recharts](https://recharts.org/)                            |
| Forms       | [React Hook Form](https://react-hook-form.com/)             |
| Database    | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| ORM         | [Knex.js](https://knexjs.org/) (query builder + migrations) |
| Auth        | JWT ([jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)) |
| Build       | [Vite](https://vite.dev/)                                   |
| Language    | TypeScript                                                   |

## Install

### Quick Install (Recommended)

Download the pre-built release and run the installer.

**System:** 1 CPU, 512MB RAM, 100MB disk | **Software:** Linux, Node.js >= 22, WireGuard tools (`wg`, `wg-quick`), root access, systemd, `unzip`

```bash
curl -fsSLO https://github.com/devaraj764/yantraform/releases/download/v0.0.1/yantraform.zip
unzip yantraform.zip
sudo bash install.sh
```

Dashboard: **http://\<server-ip\>:51821** | Default password: `admin`

```bash
sudo systemctl status yantraform
sudo systemctl restart yantraform
sudo journalctl -u yantraform -f
```

### Docker Install

No host dependencies needed — WireGuard tools and Node.js are included in the image.

**System:** 1 CPU, 512MB RAM, 500MB disk (image) | **Software:** Docker

```bash
docker run -d --cap-add NET_ADMIN --cap-add NET_RAW \
  -v yantraform-data:/app/data \
  -p 51821:51821 \
  ghcr.io/devaraj764/yantraform:latest
```

### Development

**System:** 2 CPU, 2GB RAM (Vite build needs memory) | **Software:** Node.js >= 22, WireGuard tools (`wg`, `wg-quick`), root/sudo access

```bash
npm install
npm run dev
```

The dashboard will be available at **http://localhost:51821**.

## Project Structure

```
src/
├── components/          # React UI components
│   ├── ui/              # Radix-based primitives (button, card, dialog, etc.)
│   ├── AgentPanel.tsx   # Remote agent monitoring & command execution
│   ├── Layout.tsx       # App shell with sidebar navigation
│   ├── Login.tsx        # Authentication form
│   ├── PeerForm.tsx     # Create/edit peer dialog
│   ├── QRCodeModal.tsx  # QR code display for peer configs
│   ├── TrafficChart.tsx # Traffic statistics chart
│   └── WireGuardSetup.tsx # First-run setup wizard
├── hooks/
│   └── useAuth.ts       # Authentication state management
├── lib/
│   ├── api.ts           # API client for all backend endpoints
│   └── utils.ts         # Formatting helpers
├── migrations/          # Knex database migrations
├── routes/
│   ├── api/             # Server-side API endpoints
│   │   ├── auth/        # Login, logout, session, password
│   │   ├── peers/       # CRUD, toggle, config, QR, agent
│   │   ├── server/      # Status, config, keys, start/stop/restart
│   │   └── stats/       # Per-peer and global traffic stats
│   ├── index.tsx        # Dashboard page
│   ├── peers.tsx        # Peer management page (VPN accessors)
│   ├── servers.tsx      # Agent management page (servers with yantra-agent)
│   ├── dns.tsx          # DNS records page
│   ├── firewall.tsx     # Firewall rules page
│   └── settings.tsx     # Server configuration page
├── server/
│   ├── auth.ts          # JWT auth and password hashing
│   ├── config.ts        # WireGuard config generation
│   ├── db.ts            # SQLite database layer
│   ├── dns.ts           # dnsmasq management
│   ├── firewall.ts      # Firewall detection and rule management
│   ├── hosts.ts         # /etc/hosts management
│   ├── qrcode.ts        # QR code generation
│   ├── stats-collector.ts # Background traffic data collection
│   └── wireguard.ts     # WireGuard CLI interface
├── router.tsx           # TanStack Router setup
└── styles.css           # Tailwind CSS entry point

data/
└── yantraform.db        # SQLite database (auto-created)

public/
└── agent-bin/           # Pre-built yantra-agent binaries
    ├── yantra-agent-linux-amd64
    ├── yantra-agent-linux-arm64
    └── yantra-agent-linux-armv7
```

## Configuration

All server configuration is managed through the Settings page in the UI:

- **Interface Name** — WireGuard interface (default: `wg0`)
- **Listen Port** — WireGuard UDP port (default: `51820`)
- **Server Address** — VPN subnet address (default: `10.8.0.1/24`)
- **Public Endpoint** — External IP/hostname for remote peers (auto-detection available)
- **Local IP** — LAN IP for local peers (auto-detection available)
- **DNS Servers** — DNS servers pushed to peers
- **Post Up / Post Down** — Custom scripts run on interface start/stop

## Yantra Agent

Yantraform includes a remote agent binary (`yantra-agent`) that is installed on agent machines. Once installed, agents provide:

- System information monitoring (hostname, OS, CPU, memory, disk, uptime, load)
- Remote command execution from the dashboard

The agent communicates over the VPN on port `9101` and authenticates using a per-agent access key. Pre-built binaries are included for amd64, arm64, and armv7 Linux architectures. Installation is guided step-by-step from the Agents page in the UI.

## License

All rights reserved.
