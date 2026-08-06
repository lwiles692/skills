# Distribution matrix

## Package and service selection

| Family | Install command | SSH unit | Firewall persistence | Automatic security updates |
|---|---|---|---|---|
| Debian | `apt-get install nftables fail2ban unattended-upgrades needrestart` | usually `ssh` | inspect `systemctl cat nftables`; commonly `/etc/nftables.conf` | `unattended-upgrades`, `apt-daily.timer`, `apt-daily-upgrade.timer` |
| Ubuntu | `apt-get install nftables fail2ban unattended-upgrades needrestart` | usually `ssh` | inspect unit; commonly `/etc/nftables.conf` | retain Ubuntu's packaged allowed origins; enable APT periodic scheduling |
| RHEL/Rocky/Alma | `dnf install nftables fail2ban dnf-automatic` (fail2ban may require EPEL) | usually `sshd` | inspect `systemctl cat nftables`; commonly `/etc/sysconfig/nftables.conf` | set `upgrade_type = security`; enable `dnf-automatic-install.timer` |
| Fedora | `dnf install nftables fail2ban dnf-automatic` | usually `sshd` | inspect the installed unit and config path | inspect available DNF/DNF5 automatic timers; use the install timer with security-only policy |

Never add a third-party repository merely to obtain fail2ban without explicit approval.

## Debian automatic-update policy

Install `assets/debian-20auto-upgrades` and `assets/debian-52unattended-upgrades-local`. Confirm that the security repository's Release metadata uses the expected `Debian-Security` label. Run a dry run and inspect selected origins.

## Ubuntu automatic-update policy

Do not install the Debian origins-pattern asset. Keep `/etc/apt/apt.conf.d/50unattended-upgrades` distribution defaults, enable the periodic settings, add `Automatic-Reboot "false"`, and verify that only the intended Ubuntu security pocket is selected.

## DNF automatic-update policy

Back up `/etc/dnf/automatic.conf`. In `[commands]`, set `upgrade_type = security`. Prefer `dnf-automatic-install.timer`; Red Hat documents that specialized timer units can override `download_updates` and `apply_updates` in the configuration file. Inspect the locally installed unit and `dnf-automatic(8)` before enabling it. Do not enable automatic reboot.

## Public-ingress firewall integration

Use firewalld, UFW, or the existing configuration manager when it owns host-input policy. Apply the allowlist only to the confirmed public interfaces or public zone. Do not change forwarding, egress, NAT, container, VPN, gateway, or bridge rules.

Docker, Podman, Kubernetes, libvirt, VPN, or forwarding may remain active because the nftables asset does not touch their hooks or tables. Preserve a before/after ruleset snapshot and stop if applying the host-input table changes runtime-managed rules. Treat published container ports as outside this host-input policy.

Do not install the asset when the public interfaces cannot be identified confidently, an existing input policy conflicts with the intended allowlist, or configuration management would overwrite the change. Ask the user or integrate with the policy owner instead.
