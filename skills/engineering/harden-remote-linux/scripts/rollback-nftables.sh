#!/bin/sh
set -eu

backup=${1:?backup path or __ABSENT__ required}
target=${2:?persistent nftables config path required}

if [ "$backup" = "__ABSENT__" ]; then
    rm -f "$target"
    nft delete table inet host_public_ingress 2>/dev/null || true
else
    nft delete table inet host_public_ingress 2>/dev/null || true
    install -m 644 -o root -g root "$backup" "$target"
    nft -f "$target"
fi
