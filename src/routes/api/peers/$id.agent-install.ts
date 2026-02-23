import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getPeerById } from '~/server/db';

export const Route = createFileRoute('/api/peers/$id/agent-install')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const peer = await getPeerById(params.id);
        if (!peer) return Response.json({ error: 'Not found' }, { status: 404 });

        if (!peer.access_key) {
          return Response.json({ error: 'Peer has no access key' }, { status: 400 });
        }

        const host = request.headers.get('host') || 'localhost:51821';
        const dashboardUrl = `http://${host}`;

        const script = `#!/bin/bash
set -euo pipefail

AGENT_PORT="9101"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/yantra-agent"
SERVICE_NAME="yantra-agent"
BINARY_NAME="yantra-agent"
DASHBOARD_URL="${dashboardUrl}"

echo "============================================"
echo "  yantra-agent installer"
echo "============================================"
echo ""

# Prompt for ACCESS_KEY
if [ -z "\${ACCESS_KEY:-}" ]; then
    read -rp "Enter ACCESS_KEY for this peer: " ACCESS_KEY
    if [ -z "\$ACCESS_KEY" ]; then
        echo "Error: ACCESS_KEY is required."
        echo "You can find it in the Yantraform dashboard under your server's details."
        exit 1
    fi
fi

# Prompt for port
read -rp "Agent port [\${AGENT_PORT}]: " INPUT_PORT
AGENT_PORT="\${INPUT_PORT:-\$AGENT_PORT}"

# Detect architecture and map to binary name
ARCH=\$(uname -m)
case "\$ARCH" in
    x86_64)  BIN_NAME="yantra-agent-linux-amd64" ;;
    aarch64) BIN_NAME="yantra-agent-linux-arm64" ;;
    armv7l)  BIN_NAME="yantra-agent-linux-armv7" ;;
    *)
        echo "Unsupported architecture: \$ARCH"
        exit 1
        ;;
esac

echo ""
echo "==> Configuration:"
echo "    ACCESS_KEY: \${ACCESS_KEY:0:8}..."
echo "    Port:       \$AGENT_PORT"
echo "    Arch:       \$ARCH (\$BIN_NAME)"
echo ""

# Download binary from dashboard static files
echo "==> Downloading yantra-agent for \$ARCH..."
DOWNLOAD_URL="\${DASHBOARD_URL}/agent-bin/\${BIN_NAME}"
if command -v curl &>/dev/null; then
    curl -fsSL "\${DOWNLOAD_URL}" -o "/tmp/\${BINARY_NAME}"
elif command -v wget &>/dev/null; then
    wget -qO "/tmp/\${BINARY_NAME}" "\${DOWNLOAD_URL}"
else
    echo "Error: curl or wget is required"
    exit 1
fi

# Verify download
if [ ! -s "/tmp/\${BINARY_NAME}" ]; then
    echo "Error: Downloaded binary is empty. Check that the dashboard is reachable at \${DASHBOARD_URL}"
    exit 1
fi

# Install binary
echo "==> Installing binary to \${INSTALL_DIR}/\${BINARY_NAME}..."
sudo install -m 0755 "/tmp/\${BINARY_NAME}" "\${INSTALL_DIR}/\${BINARY_NAME}"
rm -f "/tmp/\${BINARY_NAME}"

# Create config
echo "==> Creating config at \${CONFIG_DIR}/config..."
sudo mkdir -p "\${CONFIG_DIR}"
sudo tee "\${CONFIG_DIR}/config" > /dev/null <<CONF
# yantra-agent configuration
AUTH_KEY=\${ACCESS_KEY}
PORT=\${AGENT_PORT}
CONF
sudo chmod 600 "\${CONFIG_DIR}/config"

# Create systemd unit
echo "==> Creating systemd service..."
sudo tee "/etc/systemd/system/\${SERVICE_NAME}.service" > /dev/null <<UNIT
[Unit]
Description=Yantraform Agent
After=network.target

[Service]
Type=simple
ExecStart=\${INSTALL_DIR}/\${BINARY_NAME}
Restart=always
RestartSec=5
EnvironmentFile=-\${CONFIG_DIR}/config

[Install]
WantedBy=multi-user.target
UNIT

# Enable and start
echo "==> Enabling and starting \${SERVICE_NAME}..."
sudo systemctl daemon-reload
sudo systemctl enable "\${SERVICE_NAME}"
sudo systemctl restart "\${SERVICE_NAME}"

echo ""
echo "============================================"
echo "  yantra-agent installed successfully!"
echo "  Listening on port \${AGENT_PORT}"
echo "  Check status: sudo systemctl status \${SERVICE_NAME}"
echo "============================================"
`;

        return new Response(script, {
          headers: {
            'Content-Type': 'text/x-shellscript',
            'Content-Disposition': `attachment; filename="install-yantra-agent.sh"`,
          },
        });
      },
    },
  },
});
