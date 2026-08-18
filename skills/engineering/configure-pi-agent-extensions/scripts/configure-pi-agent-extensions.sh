#!/bin/sh
set -eu

PACKAGE_SOURCES='npm:@dietrichgebert/ponytail
npm:pi-web-access
npm:pi-subagents
npm:@ff-labs/pi-fff
npm:pi-context-view
npm:pi-mcp-adapter
npm:@narumitw/pi-btw
npm:@plannotator/pi-extension
npm:@narumitw/pi-goal
npm:@quintinshaw/pi-dynamic-workflows'

scope=global
mode=install

usage() {
  printf '%s\n' \
    'Usage: configure-pi-agent-extensions.sh [--local] [--dry-run | --verify-only]' \
    '' \
    'Options:' \
    '  --local        Use project-local .pi/settings.json instead of user settings.' \
    '  --dry-run      Show which packages are present or missing without changing anything.' \
    '  --verify-only  Verify configuration and extension loading without installing.' \
    '  -h, --help     Show this help.'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --local)
      scope=local
      ;;
    --dry-run)
      [ "$mode" = install ] || { printf 'Choose only one mode.\n' >&2; exit 2; }
      mode=dry-run
      ;;
    --verify-only)
      [ "$mode" = install ] || { printf 'Choose only one mode.\n' >&2; exit 2; }
      mode=verify
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if ! command -v pi >/dev/null 2>&1; then
  printf 'Pi is not installed or is not on PATH.\n' >&2
  exit 1
fi

pi_version=$(pi --version | sed -n '1p')
version_core=${pi_version%%-*}
version_major=${version_core%%.*}
version_rest=${version_core#*.}
version_minor=${version_rest%%.*}
version_patch=${version_rest#*.}
version_patch=${version_patch%%.*}

case "$version_major:$version_minor:$version_patch" in
  *[!0-9:]*|::*|*::*|*:)
    printf 'Could not parse Pi version: %s\n' "$pi_version" >&2
    exit 1
    ;;
esac

if [ "$version_major" -eq 0 ] && {
  [ "$version_minor" -lt 79 ] || {
    [ "$version_minor" -eq 79 ] && [ "$version_patch" -lt 1 ]
  }
}; then
  printf 'Pi 0.79.1 or newer is required; found %s.\n' "$pi_version" >&2
  exit 1
fi

if [ "$scope" = local ]; then
  settings_file=$PWD/.pi/settings.json
  scope_label='project-local'
else
  if [ -n "${PI_CODING_AGENT_DIR:-}" ]; then
    pi_config_dir=$PI_CODING_AGENT_DIR
  else
    : "${HOME:?HOME is required when PI_CODING_AGENT_DIR is unset}"
    pi_config_dir=$HOME/.pi/agent
  fi
  settings_file=$pi_config_dir/settings.json
  scope_label='user-level'
fi

has_source() {
  [ -f "$settings_file" ] && grep -Fq "\"$1\"" "$settings_file"
}

printf 'Pi version: %s\n' "$pi_version"
printf 'Scope: %s\n' "$scope_label"
printf 'Settings: %s\n' "$settings_file"
printf 'Package plan:\n'

for source in $PACKAGE_SOURCES; do
  if has_source "$source"; then
    printf '  [present] %s\n' "$source"
  else
    printf '  [missing] %s\n' "$source"
  fi
done

if [ "$mode" = dry-run ]; then
  exit 0
fi

if [ "$mode" = install ]; then
  for source in $PACKAGE_SOURCES; do
    if has_source "$source"; then
      printf 'Skipping existing %s\n' "$source"
    elif [ "$scope" = local ]; then
      pi install "$source" --local
    else
      pi install "$source"
    fi
  done
fi

missing=0
for source in $PACKAGE_SOURCES; do
  if ! has_source "$source"; then
    printf 'Missing from %s settings: %s\n' "$scope_label" "$source" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 1

pi list

if [ "$scope" = local ]; then
  pi --approve --offline --mode rpc --no-session < /dev/null >/dev/null
else
  pi --offline --mode rpc --no-session < /dev/null >/dev/null
fi

printf 'Verified all 10 Pi extensions for %s scope.\n' "$scope_label"
