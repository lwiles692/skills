#!/usr/bin/env bash
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/common.sh"

usage() {
  cat <<'HELP'
Fixed ffmpeg operations for traffic review. No custom filter or codec arguments.

  traffic_video.sh probe --input FILE
  traffic_video.sh overview --input FILE --output-dir NEW_DIR
  traffic_video.sh review --input FILE --at TIME --output-dir NEW_DIR [--crop X:Y:W:H]
  traffic_video.sh review --input FILE --start TIME --end TIME --output-dir NEW_DIR [--crop X:Y:W:H]
  traffic_video.sh frame --input FILE --at TIME --output-dir NEW_DIR [--crop X:Y:W:H] [--box X:Y:W:H]
  traffic_video.sh clip ...                 See clip --help for evidence export.

Common option: --ffmpeg EXECUTABLE (or FFMPEG_BIN).
Times: source-relative seconds or HH:MM:SS, up to 3 decimals.
probe: decoded dimensions, nominal frame rate, duration, and audio availability.
overview: at most 1 original frame per second, width <=640; 30 s batches, 3 s overlap.
review: at most 3 original frames per second, native-resolution PNG; 6 s around --at.
frame: one original PNG; optional separate crop and red-box annotation.
overview/review: automatic 3x3 sheets, frames.tsv, batches.tsv, and sheet-cells.tsv.
Cells are ordered left-to-right, top-to-bottom. Black trailing cells are empty.
No frames are duplicated to fill gaps. Existing output directories are rejected.
HELP
}

(($#)) || { usage; exit 1; }
operation=$1
shift
case "$operation" in
  -h|--help) usage; exit 0 ;;
  clip) exec bash "$script_dir/clip_violation.sh" "$@" ;;
  probe|overview|review|frame) ;;
  *) die "Unknown operation: $operation" ;;
esac
input='' output_dir='' at='' start='' end='' crop='' box=''
ffmpeg_bin=${FFMPEG_BIN:-ffmpeg}
while (($#)); do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --input|--output-dir|--at|--start|--end|--crop|--box|--ffmpeg)
      (($# >= 2)) || die "Missing value for $1"
      [[ -n $2 ]] || die "Empty value for $1"
      case "$1" in
        --input) input=$2 ;; --output-dir) output_dir=$2 ;; --at) at=$2 ;;
        --start) start=$2 ;; --end) end=$2 ;; --crop) crop=$2 ;;
        --box) box=$2 ;; --ffmpeg) ffmpeg_bin=$2 ;;
      esac
      shift 2 ;;
    *) die "Unknown argument: $1" ;;
  esac
done
[[ -n $input ]] || die 'Missing --input.'
case "$operation" in
  probe) [[ -z $output_dir$at$start$end$crop$box ]] || die 'probe accepts only --input and --ffmpeg.' ;;
  overview) [[ -z $at$start$end$crop$box ]] || die 'overview uses the full video and fixed sampling settings.' ;;
  review) [[ -z $box ]] || die '--box is supported only by frame.' ;;
  frame) [[ -n $at && -z $start$end ]] || die 'frame requires --at and does not accept --start/--end.' ;;
esac
source_init
source_geometry
if [[ $operation == probe ]]; then print_source; exit 0; fi
[[ -n $output_dir && ! $output_dir =~ [[:cntrl:]] ]] || die 'Supply a valid --output-dir.'
[[ $output_dir = /* ]] || output_dir="$PWD/$output_dir"
[[ ! -e $output_dir && ! -L $output_dir ]] || die "Output directory already exists: $output_dir"

begin_ms=0
finish_ms=$duration_ms
if [[ $operation == review ]]; then
  if [[ -n $at && -z $start$end ]]; then
    at_ms=$(to_ms "$at")
    ((at_ms < duration_ms)) || die '--at is outside the video.'
    begin_ms=$((at_ms - 3000))
    ((begin_ms >= 0)) || begin_ms=0
    finish_ms=$((begin_ms + 6000))
    if ((finish_ms > duration_ms)); then
      finish_ms=$duration_ms
      begin_ms=$((finish_ms - 6000))
      ((begin_ms >= 0)) || begin_ms=0
    fi
  elif [[ -z $at && -n $start && -n $end ]]; then
    begin_ms=$(to_ms "$start")
    finish_ms=$(to_ms "$end")
    ((finish_ms > begin_ms && finish_ms <= duration_ms)) || die 'Invalid review interval.'
  else
    die 'review requires either --at or both --start and --end.'
  fi
elif [[ $operation == frame ]]; then
  begin_ms=$(to_ms "$at")
  ((begin_ms < duration_ms)) || die '--at is outside the video.'
  finish_ms=$begin_ms
fi
crop_filter=''
box_filter=''
if [[ -n $crop ]]; then
  check_rect "$crop"
  crop_filter="format=rgb24,crop=$rect_w:$rect_h:$rect_x:$rect_y:exact=1"
fi
if [[ -n $box ]]; then
  check_rect "$box"
  box_filter="format=rgb24,drawbox=x=$rect_x:y=$rect_y:w=$rect_w:h=$rect_h:color=red:t=3"
fi

mkdir -p "$(dirname -- "$output_dir")"
mkdir "$output_dir"
complete=0
cleanup() { if ((complete == 0)); then rm -rf -- "$output_dir"; fi; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
print_source > "$output_dir/source.txt"
printf 'operation=%s\nrange_start_seconds=%s\nrange_end_seconds=%s\ncrop=%s\nbox=%s\n' \
  "$operation" "$(as_seconds "$begin_ms")" "$(as_seconds "$finish_ms")" "$crop" "$box" >> "$output_dir/source.txt"

run_ffmpeg() {
  local log=$1
  shift
  if ! "$ffmpeg_bin" -hide_banner -nostdin -n "$@" > /dev/null 2> "$log"; then
    tail -n 15 "$log" >&2
    die 'ffmpeg failed; incomplete output was removed.'
  fi
}

make_index() {
  local log=$1 count=$2 extension=$3
  # Rational PTS avoids using rounded showinfo pts_time as the source timestamp.
  # Floor the seek time to milliseconds so it never seeks past the indexed frame.
  awk -v limit="$count" -v offset="$begin_ms" -v ext="$extension" '
    BEGIN { print "index\tfile\tsource_seconds\tseek_seconds"; emitted=0 }
    /config in time_base:/ {
      value=$0; sub(/^.*time_base: /,"",value); sub(/,.*/,"",value)
      split(value, parts, "/"); numerator=parts[1]; denominator=parts[2]
    }
    /Parsed_showinfo/ && /pts_time:/ && emitted < limit {
      if (!denominator) exit 2
      value=$0; sub(/^.* pts:[[:space:]]*/,"",value); sub(/[[:space:]].*/,"",value)
      seconds=offset/1000 + value*numerator/denominator
      seek_ms=int(seconds*1000 + 0.000001)
      emitted++
      printf "%d\tframes/frame_%06d.%s\t%.9f\t%.3f\n", emitted, emitted, ext, seconds, seek_ms/1000
    }
    END { if (emitted != limit) exit 3 }
  ' "$log" > "$output_dir/frames.tsv" || die 'Could not map each output frame to its original timestamp.'
}

if [[ $operation == frame ]]; then
  mkdir "$output_dir/frames"
  run_ffmpeg "$output_dir/decode.log" -ss "$(as_seconds "$begin_ms")" -i "$input" \
    -map 0:V:0 -an -vf showinfo -frames:v 1 -c:v png -update 1 "$output_dir/frames/frame_000001.png"
  [[ -s $output_dir/frames/frame_000001.png ]] || die 'No frame exists at the requested time.'
  make_index "$output_dir/decode.log" 1 png
  if [[ -n $crop_filter ]]; then
    run_ffmpeg "$output_dir/crop.log" -i "$output_dir/frames/frame_000001.png" \
      -vf "$crop_filter" -frames:v 1 -c:v png -update 1 "$output_dir/crop.png"
  fi
  if [[ -n $box_filter ]]; then
    run_ffmpeg "$output_dir/box.log" -i "$output_dir/frames/frame_000001.png" \
      -vf "$box_filter" -frames:v 1 -c:v png -update 1 "$output_dir/marked.png"
  fi
else
  mkdir "$output_dir/frames" "$output_dir/sheets"
  rate=1
  extension=jpg
  transform="scale='min(640,iw)':-1"
  codec=(-c:v mjpeg -q:v 3)
  if [[ $operation == review ]]; then
    rate=3
    extension=png
    transform=${crop_filter:-null}
    codec=(-c:v png)
  fi
  printf 'sampling_rate=%s\n' "$rate" >> "$output_dir/source.txt"
  # One actual source frame per sampling bin; sparse/VFR input is never padded.
  selection="select='isnan(prev_selected_t)+gt(floor(t*$rate+0.000001),floor(prev_selected_t*$rate+0.000001))'"
  run_ffmpeg "$output_dir/decode.log" -ss "$(as_seconds "$begin_ms")" -i "$input" \
    -t "$(as_seconds "$((finish_ms - begin_ms))")" -map 0:V:0 -an \
    -vf "$selection,showinfo,$transform" -fps_mode passthrough "${codec[@]}" \
    "$output_dir/frames/frame_%06d.$extension"
  shopt -s nullglob
  frames=("$output_dir/frames/"*."$extension")
  count=${#frames[@]}
  ((count > 0)) || die 'The requested interval contains no sampled video frames.'
  make_index "$output_dir/decode.log" "$count" "$extension"

  indices=() paths=() times=() seeks=() milliseconds=()
  while IFS=$'\t' read -r index relative seconds seek; do
    [[ $index != index ]] || continue
    indices+=("$index") paths+=("$relative") times+=("$seconds") seeks+=("$seek")
    milliseconds+=("$(to_ms "$seek")")
  done < "$output_dir/frames.tsv"
  printf 'batch\tcore_start\tcore_end\tview_start\tview_end\tframes\tsheets\n' > "$output_dir/batches.tsv"
  printf 'sheet\trow\tcolumn\tframe\tsource_seconds\tseek_seconds\n' > "$output_dir/sheet-cells.tsv"

  make_batch() {
    local batch=$1 core_start=$2 core_end=$3 view_start=$4 view_end=$5
    local first=-1 length=0 pos pages slot page row column sheet label
    for ((pos=0; pos<count; pos++)); do
      if ((milliseconds[pos] >= view_start && milliseconds[pos] < view_end)); then
        ((first >= 0)) || first=$pos
        length=$((length + 1))
      fi
    done
    pages=$(((length + 8) / 9))
    printf '%d\t%s\t%s\t%s\t%s\t%d\t%d\n' "$batch" \
      "$(as_seconds "$core_start")" "$(as_seconds "$core_end")" \
      "$(as_seconds "$view_start")" "$(as_seconds "$view_end")" "$length" "$pages" >> "$output_dir/batches.tsv"
    ((length > 0)) || return 0
    printf -v label 'batch_%04d' "$batch"
    run_ffmpeg "$output_dir/$label.log" -framerate 1 -start_number "${indices[first]}" \
      -i "$output_dir/frames/frame_%06d.$extension" \
      -vf "select='lt(n,$length)',scale='min(640,iw)':-1,tile=3x3:nb_frames=9:padding=2:margin=2:color=black" \
      -frames:v "$pages" -fps_mode passthrough -c:v png "$output_dir/sheets/${label}_%04d.png"
    for ((slot=0; slot<length; slot++)); do
      pos=$((first + slot))
      page=$((slot / 9 + 1)); row=$((slot % 9 / 3 + 1)); column=$((slot % 3 + 1))
      printf -v sheet 'sheets/%s_%04d.png' "$label" "$page"
      [[ -s $output_dir/$sheet ]] || die "Missing contact sheet: $sheet"
      printf '%s\t%d\t%d\t%s\t%s\t%s\n' "$sheet" "$row" "$column" \
        "${paths[pos]}" "${times[pos]}" "${seeks[pos]}" >> "$output_dir/sheet-cells.tsv"
    done
  }

  if [[ $operation == overview ]]; then
    batch=1
    for ((core_start=0; core_start<duration_ms; core_start+=30000)); do
      core_end=$((core_start + 30000)); ((core_end <= duration_ms)) || core_end=$duration_ms
      view_start=$((core_start - 3000)); ((view_start >= 0)) || view_start=0
      view_end=$((core_end + 3000)); ((view_end <= duration_ms)) || view_end=$duration_ms
      make_batch "$batch" "$core_start" "$core_end" "$view_start" "$view_end"
      batch=$((batch + 1))
    done
  else
    make_batch 1 "$begin_ms" "$finish_ms" "$begin_ms" "$finish_ms"
  fi
fi
complete=1
printf 'Output: %s\nSource times: %s/frames.tsv\n' "$output_dir" "$output_dir"
if [[ $operation != frame ]]; then
  printf 'Frames: %d\nSheets and cell times: %s/sheet-cells.tsv\nBatches: %s/batches.tsv\n' "$count" "$output_dir" "$output_dir"
fi
