#!/usr/bin/env bash
# Video processing is performed exclusively by ffmpeg.
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/common.sh"

usage() {
  cat <<'HELP'
Create a full-resolution evidence clip and a source-frame PNG.
Aim for 15 seconds, extend for event coverage, and require at least 6 seconds.

Usage:
  clip_violation.sh --input FILE --start TIME --end TIME --plate-time TIME \
    --time YYYY-MM-DD_HH-MM-SS --plate PLATE --violation BEHAVIOR \
    --output-dir DIR [--ffmpeg EXECUTABLE]

  --start, --end   Violation interval relative to the source video.
  --plate-time     Source time of a visually confirmed, readable plate frame.
  --time           Actual capture date/time of the violation, in local time.
                   Supply a verified value; file creation time is not inferred.
  --plate          Visually confirmed plate text, used in the filename.
  --violation      Behavior label, used in the filename.

Relative times accept seconds or HH:MM:SS, with up to 3 decimal places.
Outputs: YYYY-MM-DD_HH-MM-SS-PLATE-BEHAVIOR.mp4, .png, and .txt.
The MP4 keeps the full frame and source cadence, using H.264 CRF 12.
The PNG is extracted from the source, without resizing or enhancement.
The script does not recognize plates or verify that the supplied plate is correct.
Sources lasting 6-15 seconds are exported in full. Longer event coverage is allowed.
Source videos shorter than 6 seconds and existing outputs are rejected.
HELP
}

check_component() {
  local value=$1
  case "$value" in
    ''|*/*|*\\*|*:*|*\<*|*\>*|*\"*|*\|*|*\?*|*\**) die 'Invalid filename component.' ;;
  esac
  [[ ! $value =~ [[:cntrl:]] ]] || die 'Filename components contain control characters.'
}

input='' start='' end='' plate_time='' capture_time='' plate='' violation='' output_dir=''
ffmpeg_bin=${FFMPEG_BIN:-ffmpeg}
while (($#)); do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --input|--start|--end|--plate-time|--time|--plate|--violation|--output-dir|--ffmpeg)
      (($# >= 2)) || die "Missing value for $1"
      case "$1" in
        --input) input=$2 ;; --start) start=$2 ;; --end) end=$2 ;;
        --plate-time) plate_time=$2 ;; --time) capture_time=$2 ;;
        --plate) plate=$2 ;; --violation) violation=$2 ;;
        --output-dir) output_dir=$2 ;; --ffmpeg) ffmpeg_bin=$2 ;;
      esac
      shift 2 ;;
    *) die "Unknown argument: $1" ;;
  esac
done

[[ -n $input && -n $start && -n $end && -n $plate_time && -n $capture_time && -n $plate && -n $violation && -n $output_dir ]] || die 'Missing required arguments; use --help.'
source_init
[[ ! $output_dir =~ [[:cntrl:]] ]] || die 'Output path contains control characters.'
[[ $output_dir = /* ]] || output_dir="$PWD/$output_dir"

start_ms=$(to_ms "$start")
end_ms=$(to_ms "$end")
plate_ms=$(to_ms "$plate_time")
((end_ms >= start_ms)) || die 'The violation end precedes its start.'
[[ $capture_time =~ ^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])_([01][0-9]|2[0-3])-[0-5][0-9]-[0-5][0-9]$ ]] || die 'Use actual capture time in YYYY-MM-DD_HH-MM-SS format.'
check_component "$plate"
check_component "$violation"
basename="$capture_time-$plate-$violation"
((${#basename} <= 240)) || die 'The output filename is too long.'

((duration_ms >= 6000)) || die "Source duration is $(as_seconds "$duration_ms") s; at least 6 s of real video is required."
((start_ms < duration_ms && end_ms <= duration_ms && plate_ms < duration_ms)) || die 'An event or plate time is outside the source video.'

# Keep both the complete event interval and the selected plate frame in view.
required_start=$start_ms
((plate_ms >= required_start)) || required_start=$plate_ms
required_end=$end_ms
plate_end=$((plate_ms + 100))
((plate_end <= duration_ms)) || plate_end=$duration_ms
((plate_end <= required_end)) || required_end=$plate_end
clip_duration=15000
required_duration=$((required_end - required_start))
((clip_duration >= required_duration)) || clip_duration=$required_duration
((clip_duration <= duration_ms)) || clip_duration=$duration_ms
lower=$((required_end - clip_duration))
((lower >= 0)) || lower=0
upper=$required_start
max_start=$((duration_ms - clip_duration))
((upper <= max_start)) || upper=$max_start
clip_start=$(((start_ms + end_ms - clip_duration) / 2))
((clip_start >= lower)) || clip_start=$lower
((clip_start <= upper)) || clip_start=$upper
clip_end=$((clip_start + clip_duration))

mkdir -p "$output_dir"
for extension in mp4 png txt; do
  destination="$output_dir/$basename.$extension"
  [[ ! -e $destination && ! -L $destination ]] || die "Output already exists: $destination"
done
temp_dir=$(mktemp -d "$output_dir/.clip-XXXXXXXX")
published=()
complete=0
cleanup() {
  if ((complete == 0)); then
    for extension in "${published[@]:-}"; do
      [[ -n $extension ]] || continue
      destination="$output_dir/$basename.$extension"
      if [[ "$destination" -ef "$temp_dir/result.$extension" ]]; then
        rm -f "$destination"
      fi
    done
  fi
  rm -rf "$temp_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

seek=$(as_seconds "$clip_start")
"$ffmpeg_bin" -hide_banner -loglevel error -nostdin -n \
  -ss "$seek" -i "$input" -t "$(as_seconds "$clip_duration")" \
  -map 0:V:0 -map '0:a:0?' -map_metadata 0 \
  -c:v libx264 -preset slow -crf 12 -fps_mode passthrough \
  -c:a aac -b:a 192k -movflags +faststart "$temp_dir/result.mp4"

# Decode video alone so a longer audio track cannot disguise a short video.
progress=$("$ffmpeg_bin" -hide_banner -loglevel error -nostdin \
  -i "$temp_dir/result.mp4" -map 0:V:0 -an \
  -progress pipe:1 -nostats -f null -)
video_us=''
while IFS='=' read -r key value; do
  if [[ $key == out_time_us && $value =~ ^[0-9]+$ ]]; then
    video_us=$value
  fi
done <<< "$progress"
[[ -n $video_us ]] || die 'The encoded clip contains no decodable video.'
((video_us >= 6000000)) || die 'The decoded video is shorter than 6 s; no output was published.'
expected_us=$((clip_duration * 1000))
((video_us >= expected_us - 100000 && video_us <= expected_us + 100000)) || die 'The decoded video does not cover the selected duration (tolerance 0.1 s); no output was published.'

bash "$script_dir/traffic_video.sh" frame --input "$input" --at "$(as_seconds "$plate_ms")" \
  --output-dir "$temp_dir/plate" --ffmpeg "$ffmpeg_bin" > /dev/null
cp "$temp_dir/plate/frames/frame_000001.png" "$temp_dir/result.png"
plate_frame_s=$(awk -F '\t' 'NR == 2 { print $3 }' "$temp_dir/plate/frames.tsv")

cat > "$temp_dir/result.txt" <<INFO
source=$input
event_capture_time_local=$capture_time
plate_supplied=$plate
behavior_supplied=$violation
event_source_start_s=$(as_seconds "$start_ms")
event_source_end_s=$(as_seconds "$end_ms")
plate_source_seek_s=$(as_seconds "$plate_ms")
plate_source_frame_s=$plate_frame_s
clip_source_start_s=$seek
clip_source_end_s=$(as_seconds "$clip_end")
clip_target_duration_s=$(as_seconds "$clip_duration")
decoded_video_duration_us=$video_us
encoding=H.264 CRF 12; full frame; source cadence; no enhancement
plate_validation=Caller must visually verify the source PNG and exported video.
INFO

# Hard links publish completed files without overwriting concurrent outputs.
for extension in mp4 png txt; do
  ln "$temp_dir/result.$extension" "$output_dir/$basename.$extension"
  published+=("$extension")
done
complete=1
printf 'Video: %s\nPlate frame: %s\nRecord: %s\n' \
  "$output_dir/$basename.mp4" "$output_dir/$basename.png" "$output_dir/$basename.txt"
printf 'Source interval: %s - %s s\n' "$seek" "$(as_seconds "$clip_end")"
