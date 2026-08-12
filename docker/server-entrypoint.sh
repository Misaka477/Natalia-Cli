#!/bin/bash
set -e

# SSH host keys must exist for sshd to start.
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
  ssh-keygen -A >/dev/null 2>&1
fi

# The natalia user's SSH password comes from $NATALIA_SSH_PASSWORD. When it is
# absent a random one is generated and printed to the container log so the
# operator can read it once from `docker logs`.
if [ -n "$NATALIA_SSH_PASSWORD" ]; then
  echo "natalia:$NATALIA_SSH_PASSWORD" | chpasswd
else
  PASS="$(head -c12 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c12)"
  echo "natalia:$PASS" | chpasswd
  echo "[natalia-server] SSH password for user natalia: $PASS"
fi

mkdir -p /run/sshd

# A workspace volume mounted at /workspace overrides the image layer's
# ownership; the natalia SSH user needs to write its .natalia there.
chown natalia:natalia /workspace 2>/dev/null || true

exec /usr/sbin/sshd -D -e
