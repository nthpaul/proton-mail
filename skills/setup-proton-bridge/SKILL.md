---
name: setup-proton-bridge
description: >-
  Use when connecting Proton Mail for the first time on this host, installing
  Proton Bridge, signing into Bridge, capturing this install's mailbox password,
  starting the Bridge daemon, or registering the proton-mail MCP. Prefer before
  blaming IMAP errors. Never invent Bridge credentials.
---

# Setup Proton Bridge (for proton-mail MCP)

## Goal

Get **Proton Bridge** running on **this computer** (the host where the MCP
stdio process will run — for Grok Bot, the agent's computer), mint **this
install's** mailbox password, keep Bridge always on, then register the
`proton-mail` MCP.

This is **not** Gmail OAuth. Proton has no public third-party REST API.

## Hard rules

1. **Never ask for a mailbox password from another machine** (laptop Bridge ≠
   this host). Always complete Bridge `login` here, then capture mailbox
   password from `info` on **this** install.
2. **Never paste login password, mailbox password, or OTP into chat.** Use
   secure inputs / secret-request / in-chat forms; write secrets to mode `600`
   files or plugin env only.
3. **Mailbox password ≠ Proton login password.** IMAP uses the
   Bridge-generated mailbox password after login.
4. **Paid plan** (Mail Plus or higher) is usually required for Bridge.
5. Do **not** kill an interactive Bridge CLI mid-`info` / mid-login. Prefer
   stopping a noninteractive daemon cleanly, then CLI, then restart daemon.
6. Confirm **AddMcpServer** with a question widget before changing the user's
   connector config.

## When to use

- User wants Proton Mail in Grok Bot / Cursor and Bridge is missing or down.
- `check_auth_status` fails with connection refused / auth errors.
- Fresh host: no `protonmail-bridge` / nothing on `127.0.0.1:1143`.

## Steps

### 1. Preconditions

- Confirm OS (Debian/Ubuntu amd64 preferred for official `.deb`).
- Tell the user Bridge needs Mail Plus+ and will run on **this** computer.
- Check ports: `ss -ltn | rg '1143|1025'` and whether `bridge` is already
  running.

### 2. Install Bridge (if needed)

Official Linux deb pattern (adjust version from Proton's current download):

```bash
cd /tmp
wget -O protonmail-bridge.deb \
  'https://proton.me/download/bridge/protonmail-bridge_<VERSION>_amd64.deb'
sudo apt-get install -y ./protonmail-bridge.deb
```

Headless helpers often needed: `pass`, `gnupg`, `expect`, `libsecret-tools`,
and on newer Bridge builds `libopengl0`. Initialize a local `pass` store if
Bridge's keychain expects it. Prefer `--software-renderer` on headless hosts.

### 3. Collect Proton account credentials (secure)

Collect **Proton account email** + **login password** via secure UI
(`secret-request` / `request_user_form`) — **not** chat paste.

Do **not** collect a mailbox password yet.

### 4. Bridge login once

Run:

```bash
protonmail-bridge --cli --no-window
# or: /usr/lib/protonmail/bridge/bridge --cli
```

Then `login` with the account email + login password.

- If Bridge opens a browser / captcha / device challenge: `request_box_help`.
- If Bridge asks for phone or email OTP: in-chat form (`request_user_form`)
  with `submitAfterFill` when it is a single OTP field.
- Wait until login reports success and sync can start.

### 5. Capture **this install's** mailbox password

With Bridge able to answer `info` (user not "locked" mid-sync if that blocks
`info` — wait for sync or stop daemon briefly):

1. Run CLI `info`.
2. Write **only** the mailbox password to e.g.
   `${PLUGIN_ROOT}/.bridge-mailbox-password` with mode `600`.
3. Write `${PLUGIN_ROOT}/.env` mode `600`:

```bash
PROTON_BRIDGE_USER=<proton-address>
PROTON_BRIDGE_PASSWORD=<mailbox-password-from-info>
PROTON_BRIDGE_HOST=127.0.0.1
PROTON_IMAP_PORT=1143
```

4. Ensure `.env` and `.bridge-mailbox-password` are gitignored.
5. **Never** echo those values into chat, screenshots of secret fields, or
   commit them.

### 6. Always-on daemon

Stop leftover CLI if needed, then start noninteractive and keep it up:

```bash
/usr/lib/protonmail/bridge/bridge --noninteractive --log-level info --software-renderer
```

Verify `127.0.0.1:1143` and `:1025` listen. Prefer a user systemd unit or a
documented restart path so Bridge survives reboot. Do not leave the only
copy of Bridge tied to an abandoned interactive TTY.

### 7. Prove IMAP

From the plugin root (loads `.env`):

- `check_auth_status` → reachable + inbox counts
- Optional: `list_folders` / `list_emails` on INBOX

### 8. Register MCP (Grok Bot / Cursor)

Confirm with a question widget, then `AddMcpServer`:

- `name`: `proton-mail`
- `command`: `node`
- `args`: `["${PLUGIN_ROOT}/src/index.js"]` resolved to the **absolute**
  plugin path on this host (e.g. `/workspace/proton-mail/src/index.js`)
- Prefer **not** putting the mailbox password in account `env` if the server
  loads `${PLUGIN_ROOT}/.env` itself.

Tools become available on the next turn after add.

## Done when

- Bridge daemon listening on IMAP/SMTP localhost ports
- `.env` present mode 600 with this-install mailbox password
- `check_auth_status` reachable
- `proton-mail` MCP connected (or user declined registration)

## Do not

- Scrape mail.proton.me as a substitute for Bridge
- Reuse another device's mailbox password
- Publish or commit secrets
- Submit marketplace / directory listings without an explicit approve gate
