# Prepare a scoped firewall rollback

Use this procedure for direct nftables changes. For firewalld or UFW, use the manager-specific branch in `SKILL.md` instead. Run preparation, timers, and changes inside the remote root Herdr session.

## Capture rollback inputs

Require Python 3.6 or newer and nftables JSON support before changing the policy. If Python is missing, install the distribution package inside Herdr before preparing the rollback.

Save every persistence file that the change will replace, including a root configuration modified only to add an include. Preserve each original file's owner, group, and mode. Record `__ABSENT__` for a file that does not yet exist. Use absolute backup and target paths; resolve administrator-managed symlinks explicitly before choosing a target.

Inspect `nft --json list tables`. If `inet host_public_ingress` exists, capture only that table in a root-owned snapshot:

```sh
nft --json --stateless list table inet host_public_ingress > TABLE_BACKUP
```

Replace `TABLE_BACKUP` with an absolute file path in the root-only backup directory. Require command success and validate the snapshot before proceeding. If the table is absent, use the literal `__ABSENT__` instead of a snapshot path. A permissions or command failure is not evidence that the table is absent.

The helper accepts one table declaration plus its input chains, rules, sets, maps, elements, counters, quotas, and limits. It rejects other tables, command objects such as `flush`, and non-input base chains. Use the snapshot only for restoring a prior version of this skill's host-input policy. If validation rejects the existing table, resolve ownership or compatibility before replacing it.

## Validate and schedule

Stage both rollback scripts together. Replace `ROLLBACK_SCRIPT` with the absolute path to `rollback-nftables.sh`, `TABLE_BACKUP` with the snapshot path or `__ABSENT__`, and each file pair with an original backup path or `__ABSENT__` followed by its absolute target:

```sh
sh ROLLBACK_SCRIPT --check --table-backup TABLE_BACKUP \
  --file ROOT_CONFIG_BACKUP ROOT_CONFIG_TARGET \
  --file INCLUDE_BACKUP INCLUDE_TARGET
```

Add one `--file` pair per modified persistence file. `--check` validates all inputs and asks nftables to check the owned-table transaction without applying it. Require exit status zero before scheduling the five-minute rollback timer.

Schedule the same command without `--check` using a unique systemd unit name. Replace `ROLLBACK_UNIT` with that name:

```sh
systemd-run --unit=ROLLBACK_UNIT --on-active=5m -- \
  /bin/sh ROLLBACK_SCRIPT --table-backup TABLE_BACKUP \
  --file ROOT_CONFIG_BACKUP ROOT_CONFIG_TARGET \
  --file INCLUDE_BACKUP INCLUDE_TARGET
```

Keep the scripts and inputs at those paths until verification is complete. Confirm the timer is armed before applying the firewall. Prevent concurrent changes to the owned table while this transaction is in progress.

## Verify restoration and finish

In `--check` mode, missing file backups or invalid targets fail validation before scheduling. During actual rollback, unavailable persistence inputs are recorded as failures without blocking a valid runtime restore. The helper checks the runtime transaction, replaces or removes only `inet host_public_ingress` in one JSON batch, then restores every listed persistence file. It never passes persistence-file contents to nftables, even when a restored root file contains `flush ruleset`. A file restoration failure leaves the runtime rollback in place, attempts the remaining files, and returns a nonzero exit status with the failed paths.

Preserve the original restrictive policy and unrelated tables when testing a reapplication rollback. For a first installation, verify that rollback removes the newly created owned table and restores or removes the listed persistence files as recorded. After a successful policy change, cancel the timer only after fresh SSH and the firewall checks in `SKILL.md` succeed. Inspect the rollback service result if its timer has already fired; do not report success from timer state alone.

Use [libnftables JSON documentation](https://manpages.debian.org/trixie/libnftables1/libnftables-json.5.en.html) when changing the accepted snapshot format. The helper removes old object handles and rule indexes before adding declarations to the replacement table.
