#!/usr/bin/env bash
# Real ffmpeg integration tests; all generated media stays in a temporary directory.
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/common.sh"
ffmpeg_bin=${FFMPEG_BIN:-ffmpeg}
command -v "$ffmpeg_bin" > /dev/null || die 'Install ffmpeg or set FFMPEG_BIN to run integration tests.'
temporary=$(mktemp -d "${TMPDIR:-/tmp}/traffic-video-tests.XXXXXXXX")
trap 'rm -rf -- "$temporary"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

media() { "$ffmpeg_bin" -hide_banner -loglevel error -nostdin -n "$@"; }
operation() { bash "$script_dir/traffic_video.sh" "$@" --ffmpeg "$ffmpeg_bin" > /dev/null; }
rows() { awk 'END { print NR-1 }' "$1"; }
pixels() { media -i "$1" -map 0:V:0 -frames:v 1 -pix_fmt rgb24 -f hash -hash sha256 -; }
reject() {
  if operation "$@" > "$temporary/reject.log" 2>&1; then die "Unexpected success: $*"; fi
}
source_video="$temporary/source footage.mp4"
media -f lavfi -i 'testsrc2=size=320x180:rate=25:duration=40' \
  -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=40' \
  -c:v libx264 -preset ultrafast -crf 18 -c:a aac "$source_video"
probe=$(bash "$script_dir/traffic_video.sh" probe --input "$source_video" --ffmpeg "$ffmpeg_bin")
[[ $probe == *'duration_seconds=40.000'* && $probe == *'width=320'* && $probe == *'height=180'* && $probe == *'frame_rate=25/1'* && $probe == *'audio=yes'* ]]
printf 'PASS decoded source probe\n'
media -i "$source_video" -map 0:V:0 -an -c:v copy \
  -metadata comment='Duration: 00:10:00.00 Audio: fake s:1x1 frame_rate:9/1' "$temporary/metadata.mp4"
probe=$(bash "$script_dir/traffic_video.sh" probe --input "$temporary/metadata.mp4" --ffmpeg "$ffmpeg_bin")
[[ $probe == *'duration_seconds=40.000'* && $probe == *'width=320'* && $probe == *'frame_rate=25/1'* && $probe == *'audio=no'* ]]
printf 'PASS descriptive metadata does not override measured media properties\n'

operation overview --input "$source_video" --output-dir "$temporary/overview"
[[ $(rows "$temporary/overview/frames.tsv") == 40 ]]
[[ $(rows "$temporary/overview/batches.tsv") == 2 ]]
[[ $(rows "$temporary/overview/sheet-cells.tsv") == 46 ]]
awk -F '\t' 'NR==2 { if ($2!=0 || $3!=30 || $4!=0 || $5!=33 || $6!=33) exit 1 }
  NR==3 { if ($2!=30 || $3!=40 || $4!=27 || $5!=40 || $6!=13) exit 1 }' "$temporary/overview/batches.tsv"
while IFS=$'\t' read -r sheet row column frame seconds seek; do
  [[ $sheet != sheet ]] || continue
  [[ -s $temporary/overview/$sheet && -s $temporary/overview/$frame ]]
done < "$temporary/overview/sheet-cells.tsv"
printf 'PASS overview sampling, shared overlap, and partial contact sheets\n'

operation review --input "$source_video" --start 3.010 --end 9.010 \
  --crop 30:20:101:51 --output-dir "$temporary/review"
[[ $(rows "$temporary/review/frames.tsv") == 18 ]]
awk -F '\t' 'NR==2 { if ($3!=3.04 || $4!=3.04) exit 1 }
  NR>1 { if ($3<3.01 || $3>=9.01 || (NR>2 && $3<=last)) exit 1; last=$3 }' "$temporary/review/frames.tsv"
# Use the PNG header through ffmpeg, not a separate image library.
geometry=$("$ffmpeg_bin" -hide_banner -i "$temporary/review/frames/frame_000001.png" 2>&1 || true)
[[ $geometry == *'101x51'* ]]
operation review --input "$source_video" --at 0 --output-dir "$temporary/head"
operation review --input "$source_video" --at 39.8 --output-dir "$temporary/tail"
[[ $(rows "$temporary/head/frames.tsv") == 18 && $(rows "$temporary/tail/frames.tsv") == 18 ]]
awk -F '\t' 'NR==2 { if ($2!=34 || $3!=40) exit 1 }' "$temporary/tail/batches.tsv"
printf 'PASS fractional times, exact crop size, and six-second boundary reviews\n'

operation frame --input "$source_video" --at 3.010 --crop 30:20:101:51 \
  --box 30:20:101:51 --output-dir "$temporary/frame"
reference=$(media -ss 3.010 -i "$source_video" -map 0:V:0 -frames:v 1 -pix_fmt rgb24 -f hash -hash sha256 -)
[[ $(pixels "$temporary/frame/frames/frame_000001.png") == "$reference" ]]
[[ $(pixels "$temporary/frame/marked.png") != "$reference" ]]
seek=$(awk -F '\t' 'NR==2 { print $4 }' "$temporary/frame/frames.tsv")
operation frame --input "$source_video" --at "$seek" --output-dir "$temporary/replay"
[[ $(pixels "$temporary/replay/frames/frame_000001.png") == "$reference" ]]
printf 'PASS original pixels, separate annotation, and timestamp replay\n'

media -f lavfi -i 'testsrc2=size=160x90:rate=30000/1001:duration=10' \
  -vf "select='not(between(t,2,4))'" -fps_mode vfr -c:v libx264 -preset ultrafast -crf 18 "$temporary/vfr.mp4"
operation review --input "$temporary/vfr.mp4" --start 2 --end 8 --output-dir "$temporary/vfr-review"
vfr_count=$(rows "$temporary/vfr-review/frames.tsv")
((vfr_count > 0 && vfr_count < 18))
awk -F '\t' 'NR>1 { if ($3<4 || $3>=8 || (NR>2 && $3<=last)) exit 1; last=$3 }' "$temporary/vfr-review/frames.tsv"
seek=$(awk -F '\t' 'NR==2 { print $4 }' "$temporary/vfr-review/frames.tsv")
operation frame --input "$temporary/vfr.mp4" --at "$seek" --output-dir "$temporary/vfr-replay"
[[ $(pixels "$temporary/vfr-review/frames/frame_000001.png") == "$(pixels "$temporary/vfr-replay/frames/frame_000001.png")" ]]
printf 'PASS sparse variable-frame-rate sampling without duplicated frames\n'

for length in 5.96 6 13.8; do
  media -i "$source_video" -t "$length" -map 0:V:0 -an \
    -c:v libx264 -preset ultrafast -crf 18 "$temporary/source-$length.mp4"
done
clip() {
  operation clip --input "$1" --start "$2" --end "$3" --plate-time "$4" \
    --time 2026-01-02_03-04-05 --plate 测试A12345 --violation 测试事件 --output-dir "$5"
}
for length in 6 13.8; do
  clip "$temporary/source-$length.mp4" 1 2 3 "$temporary/clip-$length"
  actual=$(awk -F '=' '$1=="clip_target_duration_s" {print $2}' "$temporary/clip-$length/2026-01-02_03-04-05-测试A12345-测试事件.txt")
  awk -v a="$actual" -v b="$length" 'BEGIN { if (a!=b) exit 1 }'
done
clip "$source_video" 12 15 16 "$temporary/clip-normal"
clip "$source_video" 0 20 10 "$temporary/clip-extended"
awk -F '=' '$1=="clip_target_duration_s" && $2!=20 {exit 1}' "$temporary/clip-extended/2026-01-02_03-04-05-测试A12345-测试事件.txt"
reference=$(media -ss 16 -i "$source_video" -map 0:V:0 -frames:v 1 -pix_fmt rgb24 -f hash -hash sha256 -)
[[ $(pixels "$temporary/clip-normal/2026-01-02_03-04-05-测试A12345-测试事件.png") == "$reference" ]]
printf 'PASS 6 s, 13.8 s, 15 s, extended clips, and plate-frame provenance\n'

reject frame --input "$source_video" --at 1 --crop 300:0:50:20 --output-dir "$temporary/bad-crop"
reject review --input "$source_video" --at 1 --fps 5 --output-dir "$temporary/custom-fps"
reject frame --input "$source_video" --at 40 --output-dir "$temporary/outside"
reject overview --input "$source_video" --output-dir "$temporary/overview"
reject clip --input "$temporary/source-5.96.mp4" --start 1 --end 2 --plate-time 3 \
  --time 2026-01-02_03-04-05 --plate 测试A12345 --violation 测试事件 --output-dir "$temporary/short"
reject clip --input "$source_video" --start 12 --end 15 --plate-time 16 \
  --time 2026-01-02_03-04-05 --plate 测试A12345 --violation 测试事件 --output-dir "$temporary/clip-normal"
[[ ! -e $temporary/bad-crop && ! -e $temporary/custom-fps && ! -e $temporary/outside && ! -e $temporary/short ]]
[[ $(rows "$temporary/overview/frames.tsv") == 40 ]]
printf 'PASS invalid bounds, locked sampling options, and collision protection\n'
