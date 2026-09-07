#!/bin/sh
set -eu

ALL_PACKAGE_IDS='ponytail web-access subagents fff context-view mcp-adapter btw plannotator goal dynamic-workflows'

scope=global
mode=install
selected_ids=
select_all=false
list_only=false

usage() {
  printf '%s\n' \
    'Usage: configure-pi-agent-extensions.sh [--local] [--dry-run | --verify-only] (--package ID)...' \
    '       configure-pi-agent-extensions.sh [--local] [--dry-run | --verify-only] --all' \
    '       configure-pi-agent-extensions.sh --list' \
    '' \
    'Options:' \
    '  --package ID   Select one extension; repeat for multiple extensions.' \
    '  --all          Select all ten extensions explicitly.' \
    '  --local        Use project-local .pi/settings.json instead of user settings.' \
    '  --dry-run      Show selected package status without changing anything.' \
    '  --verify-only  Verify selected package registrations without installing or loading code.' \
    '  --list         List valid extension IDs and npm sources.' \
    '  -h, --help     Show this help.'
}

source_for_id() {
  case "$1" in
    ponytail) printf '%s\n' 'npm:@dietrichgebert/ponytail' ;;
    web-access) printf '%s\n' 'npm:pi-web-access' ;;
    subagents) printf '%s\n' 'npm:pi-subagents' ;;
    fff) printf '%s\n' 'npm:@ff-labs/pi-fff' ;;
    context-view) printf '%s\n' 'npm:pi-context-view' ;;
    mcp-adapter) printf '%s\n' 'npm:pi-mcp-adapter' ;;
    btw) printf '%s\n' 'npm:@narumitw/pi-btw' ;;
    plannotator) printf '%s\n' 'npm:@plannotator/pi-extension' ;;
    goal) printf '%s\n' 'npm:@narumitw/pi-goal' ;;
    dynamic-workflows) printf '%s\n' 'npm:@quintinshaw/pi-dynamic-workflows' ;;
    *) return 1 ;;
  esac
}

description_for_id() {
  case "$1" in
    ponytail) printf '%s\n' 'minimal-code guidance' ;;
    web-access) printf '%s\n' 'web and document access' ;;
    subagents) printf '%s\n' 'focused child-agent delegation' ;;
    fff) printf '%s\n' 'indexed fuzzy repository search' ;;
    context-view) printf '%s\n' 'context usage inspection' ;;
    mcp-adapter) printf '%s\n' 'on-demand MCP discovery' ;;
    btw) printf '%s\n' 'side questions outside the main thread' ;;
    plannotator) printf '%s\n' 'interactive plan review' ;;
    goal) printf '%s\n' 'persistent goal completion' ;;
    dynamic-workflows) printf '%s\n' 'multi-agent workflow orchestration' ;;
    *) return 1 ;;
  esac
}

print_catalog() {
  for package_id in $ALL_PACKAGE_IDS; do
    package_source=$(source_for_id "$package_id")
    package_description=$(description_for_id "$package_id")
    printf '  %-18s %-48s %s\n' "$package_id" "$package_source" "$package_description"
  done
}

contains_selected_id() {
  case " $selected_ids " in
    *" $1 "*) return 0 ;;
    *) return 1 ;;
  esac
}

add_selected_id() {
  package_id=$1
  if ! source_for_id "$package_id" >/dev/null; then
    printf 'Unknown package ID: %s\n' "$package_id" >&2
    printf 'Run with --list to see valid IDs.\n' >&2
    exit 2
  fi
  if ! contains_selected_id "$package_id"; then
    selected_ids="${selected_ids:+$selected_ids }$package_id"
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --package)
      [ "$#" -ge 2 ] || { printf '%s\n' '--package requires an ID.' >&2; exit 2; }
      add_selected_id "$2"
      shift 2
      ;;
    --all)
      select_all=true
      shift
      ;;
    --local)
      scope=local
      shift
      ;;
    --dry-run)
      [ "$mode" = install ] || { printf 'Choose only one mode.\n' >&2; exit 2; }
      mode=dry-run
      shift
      ;;
    --verify-only)
      [ "$mode" = install ] || { printf 'Choose only one mode.\n' >&2; exit 2; }
      mode=verify
      shift
      ;;
    --list)
      list_only=true
      shift
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
done

if [ "$list_only" = true ]; then
  printf 'Available Pi extensions:\n'
  print_catalog
  exit 0
fi

if [ "$select_all" = true ]; then
  [ -z "$selected_ids" ] || { printf 'Do not combine --all with --package.\n' >&2; exit 2; }
  selected_ids=$ALL_PACKAGE_IDS
fi

if [ -z "$selected_ids" ]; then
  printf 'Select at least one extension with --package ID or use --all.\n' >&2
  exit 2
fi

if ! command -v pi >/dev/null 2>&1; then
  printf 'Pi is not installed or is not on PATH.\n' >&2
  exit 1
fi

pi_version=$(pi --version | sed -n '1p')
version_core=${pi_version%%-*}
old_ifs=$IFS
IFS=.
set -- $version_core
IFS=$old_ifs

if [ "$#" -ne 3 ]; then
  printf 'Could not parse Pi version: %s\n' "$pi_version" >&2
  exit 1
fi

version_major=$1
version_minor=$2
version_patch=$3
case "$version_major$version_minor$version_patch" in
  ''|*[!0-9]*)
    printf 'Could not parse Pi version: %s\n' "$pi_version" >&2
    exit 1
    ;;
esac

if contains_selected_id plannotator && [ "$version_major" -eq 0 ] && {
  [ "$version_minor" -lt 79 ] || {
    [ "$version_minor" -eq 79 ] && [ "$version_patch" -lt 1 ]
  }
}; then
  printf 'Pi 0.79.1 or newer is required for Plannotator; found %s.\n' "$pi_version" >&2
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

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
command -v node >/dev/null 2>&1 || { printf 'Node.js is required to read Pi settings.\n' >&2; exit 1; }

read_sources() {
  node "$script_dir/read-package-sources.mjs" "$settings_file"
}

# Validate the complete JSON before any installation. A parse error must not
# become a missing-package result inside a shell conditional.
registered_sources=$(read_sources)
has_source() {
  printf '%s\n' "$registered_sources" | grep -Fxq -- "$1"
}

printf 'Pi version: %s\n' "$pi_version"
printf 'Scope: %s\n' "$scope_label"
printf 'Settings: %s\n' "$settings_file"
printf 'Selected package plan:\n'

for package_id in $selected_ids; do
  package_source=$(source_for_id "$package_id")
  if has_source "$package_source"; then
    printf '  [present] %-18s %s\n' "$package_id" "$package_source"
  else
    printf '  [missing] %-18s %s\n' "$package_id" "$package_source"
  fi
done

if [ "$mode" = dry-run ]; then
  exit 0
fi

if [ "$mode" = install ]; then
  for package_id in $selected_ids; do
    package_source=$(source_for_id "$package_id")
    if has_source "$package_source"; then
      printf 'Skipping existing %s\n' "$package_source"
    elif [ "$scope" = local ]; then
      pi install "$package_source" --local
    else
      pi install "$package_source"
    fi
  done
fi

registered_sources=$(read_sources)
missing=0
selected_count=0
for package_id in $selected_ids; do
  package_source=$(source_for_id "$package_id")
  selected_count=$((selected_count + 1))
  if ! has_source "$package_source"; then
    printf 'Missing from %s settings: %s\n' "$scope_label" "$package_source" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 1

printf 'Verified %s selected package registration(s) for %s scope.\n' "$selected_count" "$scope_label"
printf 'Extension loading was not tested. Reload Pi and check the selected extensions before claiming they are ready.\n'
