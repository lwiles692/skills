#!/bin/sh
set -eu

backup=${1:?backup path or __ABSENT__ required}
target=${2:-/etc/ssh/sshd_config.d/60-security-hardening.conf}

if [ "$backup" = "__ABSENT__" ]; then
    rm -f "$target"
else
    install -m 644 -o root -g root "$backup" "$target"
fi

/usr/sbin/sshd -t
systemctl reload sshd.service 2>/dev/null || systemctl reload ssh.service
