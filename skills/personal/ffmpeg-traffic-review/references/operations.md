# 调用固定视频操作

通过 `scripts/traffic_video.sh` 完成所有视频处理。脚本固定技术参数，模型只选择视频、事件时间、目标区域和证据信息。运行环境需要 bash、常见 shell 文件工具、awk 及 ffmpeg，不需要 ffprobe、Python、OCR 或其他图像库。

## 设置入口

将 `TRAFFIC_SKILL_DIR` 设置为本次读取的 `SKILL.md` 所在目录。以下示例使用用户安装的软链，并以 `SOURCE_VIDEO` 和 `RESULT_DIR` 分别表示实际源视频绝对路径及新的输出目录：

```bash
TRAFFIC_SKILL_DIR="$HOME/.agents/skills/ffmpeg-traffic-review"
bash "$TRAFFIC_SKILL_DIR/scripts/traffic_video.sh" probe --input "SOURCE_VIDEO"
```

脚本查找 `PATH` 和常见 ffmpeg 安装位置。需要指定已有可执行文件时，使用 `--ffmpeg` 或 `FFMPEG_BIN`。脚本不安装依赖，也不接受自定义滤镜、编码、尺寸或抽帧频率参数。

## 选择操作

各操作的职责如下：

| 子命令 | 业务参数 | 固定行为 |
|---|---|---|
| `probe` | `--input` | 读取时长，解码首帧确认显示尺寸、标称帧率及音轨状态 |
| `overview` | `--input`、`--output-dir` | 全片每秒最多取 1 张源帧，宽度不超过 640 像素；自动按 30 秒分批、两侧各重叠 3 秒，并生成 3×3 拼图 |
| `review` | 输入、输出目录及 `--at`，或 `--start` 和 `--end`；可加 `--crop` | 每秒最多取 3 张源帧；`--at` 默认前后各 3 秒并自动处理边界；PNG 保留原分辨率，拼图单格宽度不超过 640 像素 |
| `frame` | 输入、输出目录及 `--at`；可加 `--crop`、`--box` | 提取一张完整原分辨率 PNG；另存原尺寸裁剪图或红框标注图 |
| `clip` | 已核实的事件、号牌及拍摄时间 | 调用证据截取脚本，详见[证据视频导出](clip-violation.md) |

所有相对时间接受秒数或 `HH:MM:SS`，最多 3 位小数。复查及原帧操作会选择实际存在的帧，不复制帧填充采样间隔。原片帧率低或有时间缺口时，结果可能少于预期帧数。

矩形参数格式为 `X:Y:WIDTH:HEIGHT`，均为解码后完整原图上的整数像素坐标。使用 `probe` 的尺寸及原图确定区域，不能直接使用拼图单格内的缩放坐标。脚本对越界或空矩形报错，不静默调整。裁剪保持像素尺寸，不放大或增强字符。

以下命令展示常用操作。替换路径、示例时间及目标矩形，使用独立的输出目录：

```bash
bash "$TRAFFIC_SKILL_DIR/scripts/traffic_video.sh" overview \
  --input "SOURCE_VIDEO" --output-dir "RESULT_DIR/overview"

bash "$TRAFFIC_SKILL_DIR/scripts/traffic_video.sh" review \
  --input "SOURCE_VIDEO" --at 00:01:23.500 --output-dir "RESULT_DIR/review"

bash "$TRAFFIC_SKILL_DIR/scripts/traffic_video.sh" review \
  --input "SOURCE_VIDEO" --start 00:01:20 --end 00:01:30 \
  --crop 600:300:500:250 --output-dir "RESULT_DIR/review-crop"

bash "$TRAFFIC_SKILL_DIR/scripts/traffic_video.sh" frame \
  --input "SOURCE_VIDEO" --at 00:01:24.000 \
  --crop 600:300:500:250 --box 600:300:500:250 \
  --output-dir "RESULT_DIR/plate-frame"
```

## 读取索引

脚本自动输出以下文件：

- `source.txt`：源文件、解码后尺寸、标称帧率、操作及请求区间。
- `frames.tsv`：逐帧路径、原视频实际时间 `source_seconds`、回查同一帧使用的 `seek_seconds`。后者向下取整到毫秒，避免四舍五入后跳过目标帧。
- `batches.tsv`：初筛核心区间、包含重叠的查看区间、帧数及拼图数；复查输出一批。
- `sheet-cells.tsv`：拼图路径、从 1 开始的行列、原帧路径和时间。按从左到右、从上到下的顺序查看，末页黑色空格没有对应帧。
- `frames/`、`sheets/`：原帧与拼图。`frame` 操作不生成拼图，其裁剪和标注分别为 `crop.png`、`marked.png`。

联系表不依赖 ffmpeg 的字体功能；时间由格位索引精确对应。报告展示截图时，把索引时间写入图注。标注图属于派生图，原图独立保留。

图片路径相对于本次输出目录。重复查看已有结果时读取索引及图片，不重新运行处理。已有输出目录会报错；失败时清理本次新建目录，诊断日志在成功结果中保留。

## 验证脚本变更

仅在修改脚本后，运行实际 ffmpeg 集成测试；测试媒体在临时目录生成并自动清理：

```bash
bash "$TRAFFIC_SKILL_DIR/scripts/test_traffic_video.sh"
```
