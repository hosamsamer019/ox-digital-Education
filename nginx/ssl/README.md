# Nginx SSL / TLS Certificate Directory

This directory mounts to `/etc/nginx/ssl` inside the `platform-nginx` container.

## Current Staging State: **AWAITING OPERATOR CERTIFICATES**

As verified in the Pre-Deployment Safety Audit (Phase 5.1/5.2):
- No production or staging SSL certificates are committed to this repository.
- HTTPS on port 443 cannot function until the operator provides valid certificates.
- Do NOT commit real private keys or certificates to version control.

## Required Operator Files

When preparing for HTTPS staging or production deployment:

1. **`cert.pem`** (Full Chain Certificate):
   Contains your server certificate followed by intermediate CA certificates.
   Format: PEM (Base64 ASCII, begins with `-----BEGIN CERTIFICATE-----`).

2. **`key.pem`** (Private Key):
   Contains the private key corresponding to `cert.pem`.
   Format: PEM (Base64 ASCII, begins with `-----BEGIN PRIVATE KEY-----` or `-----BEGIN RSA PRIVATE KEY-----`).
   Permissions: Restrict host permissions to owner read/write only (`chmod 600 key.pem` on Linux or `icacls` on Windows).

## Activation Procedure

Once `cert.pem` and `key.pem` are present in this directory:

1. Open `nginx/nginx.conf`.
2. Uncomment the `server { listen 443 ssl ... }` block.
3. Validate Nginx configuration syntax:
   ```bash
   docker compose -f docker-compose.production.yml exec nginx nginx -t
   ```
4. Reload Nginx configuration without downtime:
   ```bash
   docker compose -f docker-compose.production.yml exec nginx nginx -s reload
   ```
5. Verify HTTPS via curl:
   ```bash
   curl -Iv https://your-staging-domain.com/health
   ```
