#!/usr/bin/env bash
# Shared parsing and source inspection; source this file from an entry script.
export LC_ALL=C

die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

to_ms() {
  local value=$1 seconds fraction
  if [[ $value =~ ^([0-9]{1,4}):([0-5][0-9]):([0-5][0-9])(\.([0-9]{1,3}))?$ ]]; then
    seconds=$((10#${BASH_REMATCH[1]} * 3600 + 10#${BASH_REMATCH[2]} * 60 + 10#${BASH_REMATCH[3]}))
    fraction=${BASH_REMATCH[5]:-0}
  elif [[ $value =~ ^([0-9]{1,9})(\.([0-9]{1,3}))?$ ]]; then
    seconds=$((10#${BASH_REMATCH[1]}))
    fraction=${BASH_REMATCH[3]:-0}
  else
    die "Invalid time: $value; use seconds or HH:MM:SS with at most 3 decimals."
  fi
  fraction="${fraction}000"
  fraction=${fraction:0:3}
  printf '%d\n' "$((seconds * 1000 + 10#$fraction))"
}

as_seconds() { printf '%d.%03d' "$(($1 / 1000))" "$(($1 % 1000))"; }

source_init() {
  local candidate line video_found=no
  [[ -f $input && -r $input ]] || die "Source video is not readable: $input"
  [[ ! $input =~ [[:cntrl:]] ]] || die 'Source path contains control characters.'
  [[ $input = /* ]] || input="$PWD/$input"
  if ! command -v "$ffmpeg_bin" >/dev/null 2>&1; then
    [[ $ffmpeg_bin == ffmpeg ]] || die "ffmpeg is unavailable: $ffmpeg_bin"
    for candidate in /opt/homebrew/bin/ffmpeg /usr/local/bin/ffmpeg /usr/bin/ffmpeg; do
      if [[ -x $candidate ]]; then ffmpeg_bin=$candidate; break; fi
    done
  fi
  command -v "$ffmpeg_bin" >/dev/null 2>&1 || die 'ffmpeg is unavailable.'
  # A metadata-only invocation normally exits nonzero without an output.
  probe_text=$("$ffmpeg_bin" -hide_banner -nostdin -i "$input" 2>&1 || true)
  duration_ms=''
  has_audio=no
  while IFS= read -r line; do
    if [[ $line =~ ^[[:space:]][[:space:]]Duration:[[:space:]]+([0-9]+:[0-9]+:[0-9]+\.[0-9]+) ]]; then
      duration_ms=$(to_ms "${BASH_REMATCH[1]}")
    elif [[ $line == '  Stream #'* ]]; then
      [[ $line != *'Video:'* ]] || video_found=yes
      [[ $line != *'Audio:'* ]] || has_audio=yes
    fi
  done <<< "$probe_text"
  [[ -n $duration_ms ]] || die 'ffmpeg could not read a finite source duration.'
  [[ $video_found == yes ]] || die 'The source contains no video stream.'
}

source_geometry() {
  local details line
  if ! details=$("$ffmpeg_bin" -hide_banner -nostdin -i "$input" \
    -map 0:V:0 -an -vf showinfo -frames:v 1 -f null - 2>&1); then
    die 'The first video frame could not be decoded.'
  fi
  source_width=''
  source_height=''
  source_rate=unknown
  while IFS= read -r line; do
    [[ $line == '[Parsed_showinfo_'* ]] || continue
    if [[ $line =~ [[:space:]]s:([0-9]+)x([0-9]+) ]]; then
      source_width=${BASH_REMATCH[1]}
      source_height=${BASH_REMATCH[2]}
    elif [[ $line =~ frame_rate:[[:space:]]+([0-9]+/[0-9]+) ]]; then
      source_rate=${BASH_REMATCH[1]}
    fi
  done <<< "$details"
  [[ -n $source_width ]] || die 'The decoded frame dimensions are unavailable.'
}

check_rect() {
  local value=$1
  [[ $value =~ ^([0-9]{1,6}):([0-9]{1,6}):([0-9]{1,6}):([0-9]{1,6})$ ]] || die 'Use X:Y:WIDTH:HEIGHT for a rectangle.'
  rect_x=$((10#${BASH_REMATCH[1]}))
  rect_y=$((10#${BASH_REMATCH[2]}))
  rect_w=$((10#${BASH_REMATCH[3]}))
  rect_h=$((10#${BASH_REMATCH[4]}))
  ((rect_w > 0 && rect_h > 0 && rect_x + rect_w <= source_width && rect_y + rect_h <= source_height)) || die "Rectangle exceeds the decoded ${source_width}x${source_height} frame."
}

print_source() {
  printf 'source=%s\nduration_seconds=%s\nwidth=%s\nheight=%s\nframe_rate=%s\naudio=%s\n' \
    "$input" "$(as_seconds "$duration_ms")" "$source_width" "$source_height" "$source_rate" "$has_audio"
}
