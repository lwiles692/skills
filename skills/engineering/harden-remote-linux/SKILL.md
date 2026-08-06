---
name: harden-remote-linux
description: Safely harden a remote systemd Linux server over SSH while running all risky mutations inside a remote Herdr persistent session. Use for verifying an existing local SSH key before disabling password login, limiting only host-bound traffic arriving from confirmed public interfaces while preserving internal and container networking, enabling fail2ban, and configuring automatic security updates on Debian, Ubuntu, RHEL, Fedora, Rocky Linux, or AlmaLinux with timed rollback and independent reconnect tests.
---

# Harden Remote Linux

Harden one remote server at a time without risking an SSH lockout. Treat connection survival and rollback validation as part of every change.

## Non-negotiable safety rules

- Run every configuration or package mutation inside a named **remote Herdr** session. Use ordinary SSH only for read-only discovery, staging files, independent reconnect tests, and the one Herdr bootstrap exception below.
- Require root or an explicitly verified passwordless sudo path. Require systemd. If remote Herdr is missing, install it through an interactive SSH TTY with exactly `curl -fsSL https://herdr.dev/install.sh | bash`; this bootstrap is the only mutation allowed before entering Herdr. Verify the resulting binary and read its full `--skill` output before continuing.
- Never reload SSH or apply a public-ingress deny rule without a five-minute systemd rollback timer.
- Do not replace or append to `authorized_keys` unless the user explicitly requests a separate key-management change and supplies the intended public keys.
- Before changing any password-related SSH setting, prove that the specified local private key can open a fresh key-only connection to the target. Do not treat the current session or a multiplexed connection as proof.
- After each protected change, open a fresh, non-multiplexed SSH connection. Cancel its rollback timer only after that connection succeeds and the effective configuration is correct.
- Back up every replaced file under `/root/security-hardening-backup-<UTC timestamp>/`. Preserve unrelated administrator settings.
- Do not enable deprecated `ssh-rsa` SHA-1 signatures; never add `PubkeyAcceptedAlgorithms +ssh-rsa`.
- Do not run `apt autoremove`, `dnf autoremove`, automatic reboot, or automatic kernel removal.
- Scope firewall changes to host-bound `input` traffic arriving on confirmed public interfaces. Do not add, replace, or tighten `forward`, `output`, NAT, raw, or mangle rules. Never flush the ruleset. Preserve Docker, Podman, Kubernetes, libvirt, VPN, and other internal networking unchanged.
- Do not claim this host-input policy blocks Docker- or Podman-published ports. Published container traffic normally traverses forwarding and runtime-managed NAT/filter chains, which are outside this workflow.

Read [references/distro-matrix.md](references/distro-matrix.md) before installing packages or configuring automatic updates.

## Inputs

Resolve these before changing anything:

- target hostname or IP;
- remote login user, normally `root`;
- local private-key path;
- effective SSH port;
- public-facing interface names, derived from the IPv4 and IPv6 default routes and confirmed before use;
- required inbound ports. Default to SSH plus TCP 80 and 443. Confirm any additional service ports.

Provider firewalls and security groups are outside this host-level workflow. Do not probe cloud metadata or require confirmation of upstream firewall state. If the user supplies provider-firewall details, account for them, but never block host hardening because that external state is unknown.

## Workflow

### 1. Read-only preflight

Inspect OS identity, systemd, Herdr, SSH, listening sockets, firewall managers, network interfaces, package state, disk space, account list, accepted key fingerprints, failed authentication logs, containers, and failed services. At minimum inspect:

```sh
cat /etc/os-release
systemctl --version
command -v herdr || test -x /root/.local/bin/herdr
sshd -T
ss -lntup
nft list ruleset
systemctl is-active firewalld ufw docker podman kubelet libvirtd 2>/dev/null
systemctl is-enabled docker podman kubelet libvirtd 2>/dev/null
command -v docker podman 2>/dev/null
docker ps -a 2>/dev/null; docker network ls 2>/dev/null
podman ps -a 2>/dev/null; podman network ls 2>/dev/null
ip -br addr; ip route; ip -6 route
df -h /; systemctl --failed
```

Abort and explain if the target is not systemd-based, SSH configuration is already invalid, disk space is unsafe, or the host's local firewall topology cannot be determined.

### 2. Bootstrap Herdr when missing

If neither `command -v herdr` nor `/root/.local/bin/herdr` exists, run through an interactive SSH TTY:

```sh
curl -fsSL https://herdr.dev/install.sh | bash
```

Then resolve the installed binary, run `herdr --version`, and read `herdr --skill` completely. Stop if installation, version reporting, or skill discovery fails. Do not combine this bootstrap with any other server change.

### 3. Verify local key access and stage assets

Before changing password authentication, verify the intended local private key and use it for a fresh key-only connection:

```sh
test -r KEY
ssh-keygen -y -f KEY >/dev/null
ssh-keygen -lf KEY
ssh -p PORT -i KEY \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o PreferredAuthentications=publickey \
  -o PasswordAuthentication=no \
  -o KbdInteractiveAuthentication=no \
  -o ControlMaster=no \
  -o ControlPath=none \
  -o ConnectTimeout=10 \
  USER@TARGET true
```

Require exit status zero. Abort without changing password authentication if the key is unreadable, its public key cannot be derived, or the fresh connection fails. Diagnose the key authorization or target selection instead of installing fallback keys.

Stage the assets and rollback scripts under a root-only remote staging directory. Staging may use SCP; applying them must occur in Herdr. Verify checksums after transfer.

Attach a named remote session and confirm the pane environment before proceeding:

```sh
ssh -tt -i KEY -o IdentitiesOnly=yes root@TARGET 'cd /root && exec /root/.local/bin/herdr --session linux-hardening'
test "$HERDR_ENV" = 1
```

### 4. Disable SSH password authentication

Inspect whether `/etc/ssh/sshd_config` includes `sshd_config.d` before later conflicting values. If the drop-in is not honored, adapt the main file under rollback protection rather than assuming.

Inside Herdr, back up the SSH configuration, schedule `scripts/rollback-sshd.sh BACKUP_OR___ABSENT__ TARGET`, install `assets/60-security-hardening.conf`, run `sshd -t`, inspect `sshd -T`, and reload the correct unit (`ssh` or `sshd`). Require these effective values:

```text
PermitRootLogin prohibit-password (may display as without-password)
PasswordAuthentication no
KbdInteractiveAuthentication no
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
```

Repeat the same fresh key-only connection with the specified local key. Also make a non-interactive password-only probe and verify that the server reports only `publickey`. Cancel rollback only after both checks.

### 5. Apply the firewall

Identify every public-facing interface from the IPv4 and IPv6 default routes. Stop and ask if the outward-facing interfaces are ambiguous. Treat loopback, container bridges, virtual interfaces, VPNs, and private-only interfaces as internal; do not restrict traffic arriving on them.

If firewalld, UFW, or another configuration manager owns host-input policy, express the same public-interface allowlist through that manager. Otherwise derive `assets/nftables-public-ingress.conf`, replacing `__PUBLIC_INTERFACES__` and `__ALLOWED_TCP_PORTS__`. Default the TCP ports to the effective SSH port plus 80 and 443. Reject any derived file that still matches `__[A-Z0-9_]+__`, and always run `nft -c -f` before application.

The nftables asset owns only `table inet host_public_ingress`. It accepts established traffic, ICMP/ICMPv6, DHCP client replies, and approved TCP ports on the confirmed public interfaces, then drops other host-bound traffic from those interfaces. Its base-chain policy remains `accept`, so traffic from every other interface continues normally. It defines no `forward`, `output`, or NAT chain and contains no `flush ruleset` command.

Preserve the system's persistent configuration layout. Prefer installing the derived table as a dedicated included file rather than replacing a root configuration that contains other rules. Back up every modified persistence file and schedule `scripts/rollback-nftables.sh BACKUP_OR___ABSENT__ TARGET` before applying. When reapplying, delete only the skill-owned `inet host_public_ingress` table, then load the validated derived file. Never reload a configuration that flushes unrelated tables.

From a new connection verify:

- SSH still works;
- the confirmed public interfaces allow the approved host TCP ports and reject an unapproved host-listening test port when an external test is safely available;
- traffic arriving from loopback, private interfaces, VPNs, and container bridges is not restricted by the new table;
- host DNS and outbound HTTPS work;
- required ICMP/ICMPv6 and established traffic are accepted;
- `forward`, `output`, NAT, and container-runtime rules match the pre-change snapshot.

If a representative container already exists, verify its DNS, outbound HTTPS, and connection to a host service without creating or changing container networks. Report published container ports separately as outside the host-input policy.

Cancel rollback. If fail2ban was already running, restart it after any nftables ruleset reload so it recreates its table.

### 6. Enable fail2ban

Install the distribution package named in the matrix. Derive `assets/fail2ban-jail.local`, adjusting the SSH port and replacing `__TRUSTED_NETWORKS__` with the management source plus every connected loopback, private, VPN, and container subnet. Keep the ban action on host SSH input only; do not let it add forwarding or egress rules. Use the systemd journal backend only when the packaged SSH jail supplies a valid journal match.

Run `fail2ban-client -t`, enable/restart the service, and verify `fail2ban-client status sshd`. Confirm its nftables action appears after an actual ban; do not intentionally ban the current management address.

### 7. Enable automatic security updates

Follow the detected distribution branch in the matrix.

- Debian: use the bundled Debian APT assets and validate with `unattended-upgrade --dry-run --debug`.
- Ubuntu: preserve the distribution-provided allowed-origin rules and add only periodic scheduling/reboot policy; validate with a dry run.
- RHEL-family/Fedora: install `dnf-automatic`, set `upgrade_type = security`, and enable the installed `dnf-automatic-install.timer`. Inspect local man pages and unit files because timer behavior may override `automatic.conf`.

Keep automatic reboot and dependency/kernel removal disabled. Verify timer state and the next scheduled run.

### 8. Final verification and handoff

Use a fresh SSH connection and report:

- target OS and kernel;
- verified local public-key fingerprint and successful fresh key-only login;
- effective SSH authentication methods;
- confirmed public interfaces, the host-input table, and allowed host inbound ports;
- confirmation that `forward`, `output`, NAT, and container-runtime rules were preserved, plus any container connectivity test performed;
- published container ports as explicitly outside the host-input policy;
- fail2ban jail status and current bans;
- automatic-update package, policy, timer, and dry-run result;
- `dpkg --audit` or RPM/DNF consistency result;
- failed systemd units;
- backup directory and exact rollback files.

Do not probe or report provider-firewall or security-group status unless the user specifically asks for it.

Do not claim ports 80/443 serve traffic merely because the firewall permits them; separately report whether a process is listening.
