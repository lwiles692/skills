# Skills 指令审计

审计日期：2026-09-07。范围：`skills/`。结论：发现 1 项 P1 和 6 项 P2 问题，另有 2 项可选精简建议。优先处理回滚边界、执行目录和验证结果可信度，再精简交互与上下文。初次交付仅包含审计报告；随后已按用户授权完成整改，结果见下一节。

基准提交：`400ed0afeaaadf1c36d5f96afddab29983fe1a56`。开始审计时，`audit-agent-instructions/SKILL.md` 已修改，官方 Astra 原文存档尚未跟踪；按工作区当前内容审查并保留这两项已有改动。

## 整改结果（2026-09-07）

用户随后授权全部优化，F1–F7 与 O1–O2 均已落实。下文发现、行号和文件大小保留为整改前审计记录；本节记录当前实现与验收，不把原始发现视为仍未解决。

| 项目 | 已实施变更 | 验证 |
| --- | --- | --- |
| F1 | 将回滚改为仅恢复 `inet host_public_ingress` 的 JSON 事务；持久化文件逐项单独恢复。预检严格核对所有输入，实际回滚时文件备份缺失不阻止有效的运行时恢复 | 覆盖含 `flush ruleset` 的根备份、多文件、旧表恢复、首次安装、已无表、非法快照、检查模式、nft 失败及文件备份丢失 |
| F2 | SSH、SCP 和 Herdr 明确复用端口、密钥与登录身份；补充 root/sudo 分支和解析后的 Herdr 路径 | 静态核对示例与输入契约；未连接真实服务器。整改基准中的首次密钥探测已包含 `-p PORT`，本次主要补齐 Herdr/SCP 路径并统一占位符，纠正原发现对此处的过宽表述 |
| F3 | Pi 指令使用相对技能解析出的绝对脚本路径，保持目标项目工作目录 | 在名称含空格、独立于技能路径的临时项目验证预览和安装目录 |
| F4 | 按 JSON `packages` 数组解析字符串项和对象项，拒绝无效配置；去掉整套扩展启动探测，只报告已登记状态 | 覆盖无关字段误匹配、对象项、空/缺失配置、无效 JSON、保留未选包和配置；替身 Pi 拒绝所有非预期启动命令 |
| F5 | 补齐 Codex 手动调用策略；校验器使用 YAML 解析器检查布尔类型和跨宿主一致性 | 默认策略、显式策略、内联 YAML、缺失配对、无关嵌套字段、字符串布尔值、无效与重复键均有覆盖 |
| F6 | Pi、目标撰写和定价技能复用已有选择及授权，只询问实质缺口 | 独立代理按完整选择、已授权启动及保存值不符等场景演练，未发现重复确认障碍 |
| F7 | 保存后回读价格、单位、通道与零值；不匹配和无法回读均不计为成功，并限制同一行重试 | 独立代理确认列表移除但值不符时会纠正或记为未解决；未操作真实定价后台 |
| O1 | 所有技术文档仍应用风格规则，但局部修正只读相关规则；完整分阶段检查用于实质性工作 | 独立代理对单句修正场景不再要求全量参考加载 |
| O2 | 依赖替换/设计记录审查移入同技能参考文件；目标示例和常见错误移入按需参考 | 条件性入口与相对文件链接检查通过 |

变更入口包括 [防火墙回滚实现](../../skills/engineering/harden-remote-linux/scripts/rollback-nftables.py)、[回滚流程](../../skills/engineering/harden-remote-linux/references/firewall-rollback.md)、[Pi 登记解析器](../../skills/engineering/configure-pi-agent-extensions/scripts/read-package-sources.mjs)、[调用策略校验器](../../scripts/validate-skills.mjs) 和各技能入口。新增的 `yaml` 开发依赖及锁文件用于真实 YAML 解析，避免用正则模拟策略结构；开发说明补充了 `npm ci` 和 Python 前提。

整改后验收：

- `npm test`：41 项通过，0 项失败。
- `npm run validate`：9 个技能通过，包含仓库私有技能。
- `git diff --check`、相对文件链接、Shell/Python 语法检查通过。
- 系统附带 `quick_validate.py`：5 个修改技能通过；定价技能因校验器不接受已有的 `disable-model-invocation` 字段而返回失败。保留该字段以满足仓库跨宿主调用策略，未为迁就系统校验器而移除它；仓库校验器已解析并检查这一策略。
- 独立场景复核发现的“文件备份丢失阻断运行时回滚”已修复并加入回归测试。

所有执行测试使用本地临时夹具与替身命令。真实 Linux 内核规则恢复、发行版服务集成、第三方扩展加载和定价 UI 保存仍需在对应目标环境验证，未宣称此次测试覆盖这些环境。未提交或推送。

## 依据与范围

本次完整阅读以下仓库原文存档，将其作为审计方法参考，不把其中示例提示词作为操作授权：

- Eric Provencher，原题 [Rethinking skills and prompts for GPT-6 Astra](https://x.com/pvncher/status/2095991462416490862)，[本地全文存档](../../skills/engineering/audit-agent-instructions/references/pvncher-2026-09-04-rethinking-skills-and-prompts-for-gpt-6-astra.md)，标注归档日期 2026-09-06。此次在线直读返回 403，未重新核验网页及其图片；正文依据为仓库存档。
- OpenAI，[Model guidance — Using GPT-6 Astra](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra)，[官方 Markdown 存档](../../skills/engineering/audit-agent-instructions/references/openai-2026-09-06-using-gpt-6-astra.md)，标注归档日期 2026-09-06。全文已读，使用其中 Prompting best practices 讨论的授权延续、完成条件、指令冲突与适量验证；不据此断言其他模型行为。
- OpenAI，[Build skills](https://learn.chatgpt.com/docs/build-skills#optional-metadata)，2026-09-07 在线读取，用于核对 Codex 调用策略字段及默认值。

作者关于渐进披露、避免过度流程化的观点用于寻找线索；以下缺陷以仓库指令、脚本、当前宿主工具约束及本地复现为证据。没有仅凭行数、强制词或个人措辞偏好判定缺陷。

已阅读全部 8 个 `SKILL.md` 和全部 8 个 `agents/openai.yaml`，并沿引用阅读支持文件。`skills/` 内未发现额外的 `AGENTS.md`、`CLAUDE.md`、大小写变体、符号链接、断链或被 Git 忽略的文件。文件真实目标均为原路径。

范围外读取了根 `AGENTS.md`、`.agents/invocation.md`、结构校验器和现有测试，以核对仓库契约。`.agents/skills/` 不属于用户指定审查范围，但现有校验命令会覆盖其中 1 个技能，因此输出为 9 个技能。排除 Git 内部文件、依赖及构建输出；未扩展审计全局技能库。宿主已安装的审计技能比工作区版本旧，本次范围和事实判断使用工作区文件；Google 风格参考文件与已读取的安装副本逐字节一致。

支持文件检查属于静态阅读和针对性复现，未做所有脚本的完整运行审计，未运行远程加固、安装 Pi 包、调用外部付费审查模型或修改定价后台。

## 优先整改

### F1 · P1 · 防火墙回滚可重新加载整套规则，破坏保留边界

位置：[rollback-nftables.sh](../../skills/engineering/harden-remote-linux/scripts/rollback-nftables.sh)，第 10–13 行；[加固入口](../../skills/engineering/harden-remote-linux/SKILL.md)，第 129 行。

入口要求保留持久化布局、备份每个修改文件，且明确要求 “Never reload a configuration that flushes unrelated tables.” 但脚本接受任意持久化配置路径，恢复文件后无条件执行 `nft -f "$target"`。当为了添加 include 而修改根配置，且备份包含 `flush ruleset` 时，回滚会重新执行这一命令。当前接口也只能接收一对备份和目标，未区分多个持久化文件恢复与运行时表恢复。

本地复现：用临时文件和替身 `install`、`nft` 执行原脚本，传入包含 `flush ruleset` 的备份。脚本退出 0，记录显示该内容确实被传给 `nft -f`。没有运行真实防火墙命令。

影响：在回滚最需要可靠的时候，可能清除容器或其他管理器维护的运行时规则，违背技能明确承诺。

建议：将持久化文件恢复与运行时恢复分开。回滚可恢复全部已修改文件，但运行时只删除或恢复 `inet host_public_ingress`；只加载经过验证、仅包含该表的快照。明确禁止把包含全局操作的根配置传入运行时恢复步骤，并为 firewalld/UFW 分支定义对应的回滚机制。

验证：使用根配置含 `flush ruleset`、仅表配置、此前无表、多个持久化文件四类夹具检查命令边界；之后在隔离 Linux 环境验证实际规则。替身复现只证明危险输入能到达命令，不证明真实内核状态恢复正确。

### F2 · P2 · SSH 示例未携带已识别的端口和登录身份

位置：[加固入口](../../skills/engineering/harden-remote-linux/SKILL.md)，第 30–33、81–100 行。

入口接受远程登录用户、非默认 SSH 端口和已验证的免密 sudo 路径，但新连接示例没有 `-p SSH_PORT`；Herdr 示例还固定为 `root@TARGET` 和 `/root/.local/bin/herdr`。这与前面接受的输入范围不一致。

影响：服务器只监听 2222、仅允许普通管理员登录或禁止 root 登录时，照示例执行会连错端口或用户，可能把有效密钥误判为失败。该问题通常会提前阻断流程，而不是直接导致锁机。

建议：在示例中明确复用目标、端口、用户和密钥；用 `ssh -p SSH_PORT`，文件传输用对应端口参数。Herdr 连接使用已验证用户，必要时经已验证的 `sudo -n` 进入特权会话；使用已解析的 Herdr 路径。保留非复用连接和 key-only 验证。

验证：用替身 SSH/SCP 检查端口、身份和路径参数，再在隔离目标上验证非 22 端口及 sudo 登录分支。

### F3 · P2 · Pi 脚本路径与项目工作目录混淆

位置：[Pi 配置入口](../../skills/engineering/configure-pi-agent-extensions/SKILL.md)，第 49–58 行；[配置脚本](../../skills/engineering/configure-pi-agent-extensions/scripts/configure-pi-agent-extensions.sh)，第 180–181、221–222 行。

入口给出 `./scripts/configure-pi-agent-extensions.sh`，没有说明从技能目录解析绝对路径并保持目标项目为工作目录。脚本却用 `$PWD/.pi/settings.json` 确定项目范围，并在当前目录调用 `pi install --local`。

影响：在目标项目照抄命令会找不到脚本；为了找到脚本而切换到技能目录，则可能将本地扩展安装到技能目录。

建议替换引导句为：“Resolve the script to an absolute path relative to this SKILL.md. Run it with the target project as the working directory; do not change into the skill directory.” 示例使用 `sh /ABSOLUTE_SKILL_DIR/scripts/configure-pi-agent-extensions.sh ...`，并解释占位符。

验证：在技能目录之外创建临时项目，以绝对脚本路径执行 `--local --dry-run`，确认输出的 Settings 路径指向临时项目。

### F4 · P2 · Pi 用全文字符串匹配判断安装状态，可能报告虚假成功

位置：[配置脚本](../../skills/engineering/configure-pi-agent-extensions/scripts/configure-pi-agent-extensions.sh)，第 194–195、219–220、234–249 行。

`has_source()` 只查找整个 JSON 中是否出现带引号的 npm source，不检查其是否属于 `packages`。它同时决定跳过安装和验证成功。

本地复现使用 `{"packages":[],"audit_note":"npm:pi-web-access"}`，以替身 Pi 提供版本与成功退出。原脚本将 web-access 标为 present，`--verify-only` 返回 0，并输出 “Verified 1 selected Pi extension(s)”。这一复现隔离了脚本自身的判断错误，未声称真实 Pi 会接受所有任意配置字段。

影响：其他设置或扩展保存的 source 字符串可能误触发“已安装”，导致不安装所选扩展，却向用户报告完成。RPC 成功启动本身也不等于目标扩展加载成功。

建议：按 JSON 结构解析 `packages`，覆盖目标 Pi 支持的字符串项与对象项，拒绝无效 JSON；区分“设置中已登记”和“扩展已加载”。如果启动检查无法证明选中扩展成功加载，降低完成报告的承诺。核对启动时是否会加载未选择的扩展，因为入口第 45 行承诺不验证未选择项。

验证：覆盖空 packages、source 仅在无关字段、有效字符串项、有效对象项及无效 JSON；使用可识别的加载失败夹具核对报告。未选择扩展是否会被实际执行，仍需目标 Pi 版本的集成验证。

### F5 · P2 · 定价技能的手动调用策略未同步到 Codex

位置：[定价入口](../../skills/engineering/new-api-model-pricing/SKILL.md)，第 4 行；[Codex 元数据](../../skills/engineering/new-api-model-pricing/agents/openai.yaml)，第 1–4 行。

入口设置 `disable-model-invocation: true`，但 `agents/openai.yaml` 没有相应策略。仓库 `.agents/invocation.md` 要求各宿主的手动调用限制一致。Codex 官方文档规定 `policy.allow_implicit_invocation` 缺省为 true，因此当前元数据没有表达相同的禁止隐式调用意图。[官方字段说明](https://learn.chatgpt.com/docs/build-skills#optional-metadata)

影响：同一技能在支持相应 frontmatter 的宿主和 Codex 中可能具有不同触发边界。

建议：若保留当前手动调用意图，在 Codex 元数据增加 `policy: { allow_implicit_invocation: false }`。若产品意图是自动识别定价请求，则一致移除禁用策略；不要仅凭字段缺失猜测产品选择。扩充校验器，检查两个入口的策略一致性；当前校验器只检查 YAML 文件存在。

验证：用一致与不一致的元数据夹具验证校验器，再分别检查显式调用和未点名请求的宿主行为。

### F6 · P2 · 三个技能要求重复确认，未复用已有明确输入

位置与明确要求：

- [Pi 配置入口](../../skills/engineering/configure-pi-agent-extensions/SKILL.md)，第 12–21 行：“Before previewing or installing anything, call the host's `askUserQuestion` tool”，并固定四组问题。即使用户已给出包和安装范围，也没有跳过分支。
- [目标撰写入口](../../skills/engineering/write-goal/SKILL.md)，第 18–20、28–29、57–61 行：“Expect more than one round.”；用户批准措辞后仍要求询问是否启动，即使同一会话已明确要求启动。
- [定价入口](../../skills/engineering/new-api-model-pricing/SKILL.md)，第 32 行：“Before submitting the browser saves, obtain the required action-time confirmation for the specific models and price data.” 未说明该要求来自哪种宿主约束，也未说明如何复用已批准的模型和价格。

影响：明确的“仅在当前项目安装 web-access”或“按这个完整目标启动”等请求仍可能停在重复提问。Pi 还按某一工具的名字和多选 schema 固定交互；当前宿主有其他提问能力，但没有该同名工具，有限问题数量及模式约束也不同。原文已有纯文本兜底，所以不是完全无法使用，而是存在可避免的交互停顿。

建议：统一为“Reuse selections, wording, scope, and authorization already supplied in this conversation. Ask only for missing decisions that materially affect the result, using the host's available input capability.” 目标只要求用户明确授权启动，不把额外轮次当完成条件；定价先形成模型及价格清单，只有新增映射、范围变化或真实宿主权限规则要求时再确认。保留无选择不安装、别名映射需明确依据、预算只在用户要求时设置等约束。

验证：至少对比四类交互：输入完整、仅缺范围、只要求写草稿、已授权启动或保存。静态词句检查不能证明代理不会再次询问，需要实际交互验证。此项是审计发现，没有导致本次向用户索取审批。

### F7 · P2 · 定价完成检查只证明列表变化，未证明保存值正确

位置：[定价入口](../../skills/engineering/new-api-model-pricing/SKILL.md)，第 21、32–34 行。

技能要求填写输入、输出与缓存价格，但保存后只要求验证模型离开未定价列表。移出列表不足以证明每个字段、开关、单位和零值都与源数据一致。

影响：只保存一个价格通道或某个字段填错时，模型仍可能离开未定价列表，流程却将其记为 saved。这是验证契约缺口；本次未连接后台，未声称观察到了具体 UI 保存错误。

建议：保存后重读持久化模型配置，逐项比较启用通道及价格与本次源数据映射；确认无值字段未被意外启用。随后再核对未定价列表和所有原始行的去向。

验证：在测试后台覆盖零价、缓存价缺失、部分保存、错误单位和保存失败；只有回读一致才归类为已保存。

## 可选精简

### O1 · Google 风格技能对小改动加载和检查过重

位置：[文档技能](../../skills/productivity/write-google-style-docs/SKILL.md)，第 3、12–14、39–57 行。

该技能将每项技术文档改动都设为完整流程。一个 README 单句命令说明修正，也可能同时触发 core、structure、technical、word-choice 和 review-checklist 五份参考资料。这五份文件共 21,711 字节，还不含入口；这是实际命中条件带来的加载成本，不是按长度直接判断质量。

建议在保留“所有技术文档任务都应用该风格”意图的前提下，允许局部修正只读取相关规则，复用当前上下文中已读内容，把完整分阶段检查限定到新稿、实质性改写和正式审计。保留技术事实核验、用户术语优先及非英语适配。用单句修正与长文审计比较实际读取文件和结果质量。

### O2 · 条件性专业流程可迁移，避免强行合并技能

[find-code-simplifications](../../skills/engineering/find-code-simplifications/SKILL.md) 的依赖替换与设计记录保留流程（第 69–93 行）可迁入同技能的 `references/`，入口保留条件性指针。[write-goal](../../skills/engineering/write-goal/SKILL.md) 的示例和常见错误表（第 63–98 行）可作为按需参考。

两者属于维护优化，未观察到错误行为。不要为了压缩行数拆散加固的回滚约束，也不建议合并代码审查、代码简化和指令审计：它们的输入范围、证据与输出契约不同。

## 每个技能的处理建议

| 技能 | 建议 | 必须保留 |
| --- | --- | --- |
| adversarial-code-review | 本次未确认需要整改的入口缺陷；维持现有结构 | 显式选择单一外部 reviewer、只审查、超时与输出限制、来源和许可证声明 |
| audit-agent-instructions | 保留当前工作区改进；不覆盖已有修改 | 原文依据、当前文件审计、未验证范围、用户授权延续 |
| configure-pi-agent-extensions | F3、F4、F6 | 只处理所选包、保留配置与凭证、空选择不安装 |
| find-code-simplifications | 可选 O2 | 调用点证据、反证、兼容性、净简化与授权范围 |
| harden-remote-linux | 优先 F1，再处理 F2 | 密钥新连接验证、定时回滚、禁止全局清空、容器流量边界 |
| new-api-model-pricing | F5、F6、F7 | 精确匹配、零价有效、别名映射授权、每行可追溯 |
| write-goal | F6，可选 O2 | 明确完成证据、撰写与启动区分、预算选择、真实宿主能力 |
| write-google-style-docs | 可选 O1 | 技术真相、用户和项目术语优先、语言范围、可访问性 |

## 检查结果与限制

- `npm test`：9 项通过，0 项失败。测试使用临时 Git 仓库及替身 reviewer/OCR，主要覆盖 adversarial-code-review 包装器；不代表真实 CLI、远程加固、Pi 或定价 UI 已通过集成验证。
- `npm run validate`：通过，输出 `Validated 9 skills.`。现有实现检查 frontmatter、名称、描述和元数据文件存在，不验证完整 YAML、调用策略一致性、脚本执行或代理行为。
- `skills/` Markdown 相对文件链接检查：未发现缺失目标。未验证所有外部链接、网页锚点和归档外链；Astra 存档的站点根路径链接按存档注释解析。
- F1 和 F4 使用临时目录及本地替身命令复现。所有临时夹具均已清理。
- 未执行目标宿主的完整跨平台集成测试，未核对每个 Pi 第三方包当前兼容版本，未验证每个发行版包名、真实服务和自动更新行为。
- 未核验外部 reviewer 所有实时 CLI 参数。读取了 bundled OCR fallback 与加载代码，未更新上游副本；其 Apache-2.0 标注和 find-code-simplifications 的 MIT 许可证均应保留。

## 文件清单

下表由审计时的 `skills/` 文件生成。所有文件均为普通文件，真实目标与相对路径一致；“已读”表示完整静态阅读，不表示业务运行验证。除专项发现涉及的文件外，支持文件暂无独立整改建议。

| 相对路径 | 字节 | 阅读状态 |
| --- | ---: | --- |
| `skills/engineering/README.md` | 380 | 已读 |
| `skills/engineering/adversarial-code-review/SKILL.md` | 4802 | 已读 |
| `skills/engineering/adversarial-code-review/agents/openai.yaml` | 250 | 已读 |
| `skills/engineering/adversarial-code-review/references/agent-profiles.md` | 1811 | 已读 |
| `skills/engineering/adversarial-code-review/references/open-code-review-delegate.md` | 6275 | 已读 |
| `skills/engineering/adversarial-code-review/scripts/lib/agents.mjs` | 5125 | 已读 |
| `skills/engineering/adversarial-code-review/scripts/lib/args.mjs` | 4422 | 已读 |
| `skills/engineering/adversarial-code-review/scripts/lib/delegate.mjs` | 2105 | 已读 |
| `skills/engineering/adversarial-code-review/scripts/lib/errors.mjs` | 438 | 已读 |
| `skills/engineering/adversarial-code-review/scripts/lib/prompt.mjs` | 2135 | 已读 |
| `skills/engineering/adversarial-code-review/scripts/lib/reviewer.mjs` | 5721 | 已读 |
| `skills/engineering/adversarial-code-review/scripts/review.mjs` | 3005 | 已读 |
| `skills/engineering/audit-agent-instructions/SKILL.md` | 8518 | 已读 |
| `skills/engineering/audit-agent-instructions/agents/openai.yaml` | 132 | 已读 |
| `skills/engineering/audit-agent-instructions/references/openai-2026-09-06-using-gpt-6-astra.md` | 16972 | 已读 |
| `skills/engineering/audit-agent-instructions/references/pvncher-2026-09-04-rethinking-skills-and-prompts-for-gpt-6-astra.md` | 5740 | 已读 |
| `skills/engineering/configure-pi-agent-extensions/SKILL.md` | 5660 | 已读 |
| `skills/engineering/configure-pi-agent-extensions/agents/openai.yaml` | 261 | 已读 |
| `skills/engineering/configure-pi-agent-extensions/scripts/configure-pi-agent-extensions.sh` | 6939 | 已读 |
| `skills/engineering/find-code-simplifications/LICENSE` | 1065 | 已读 |
| `skills/engineering/find-code-simplifications/SKILL.md` | 8723 | 已读 |
| `skills/engineering/find-code-simplifications/agents/openai.yaml` | 254 | 已读 |
| `skills/engineering/harden-remote-linux/SKILL.md` | 11968 | 已读 |
| `skills/engineering/harden-remote-linux/agents/openai.yaml` | 236 | 已读 |
| `skills/engineering/harden-remote-linux/assets/60-security-hardening.conf` | 142 | 已读 |
| `skills/engineering/harden-remote-linux/assets/debian-20auto-upgrades` | 118 | 已读 |
| `skills/engineering/harden-remote-linux/assets/debian-52unattended-upgrades-local` | 334 | 已读 |
| `skills/engineering/harden-remote-linux/assets/fail2ban-jail.local` | 233 | 已读 |
| `skills/engineering/harden-remote-linux/assets/nftables-public-ingress.conf` | 643 | 已读 |
| `skills/engineering/harden-remote-linux/references/distro-matrix.md` | 3006 | 已读 |
| `skills/engineering/harden-remote-linux/scripts/rollback-nftables.sh` | 396 | 已读 |
| `skills/engineering/harden-remote-linux/scripts/rollback-sshd.sh` | 345 | 已读 |
| `skills/engineering/new-api-model-pricing/SKILL.md` | 2513 | 已读 |
| `skills/engineering/new-api-model-pricing/agents/openai.yaml` | 213 | 已读 |
| `skills/engineering/write-goal/SKILL.md` | 10514 | 已读 |
| `skills/engineering/write-goal/agents/openai.yaml` | 223 | 已读 |
| `skills/productivity/write-google-style-docs/SKILL.md` | 6105 | 已读 |
| `skills/productivity/write-google-style-docs/agents/openai.yaml` | 306 | 已读 |
| `skills/productivity/write-google-style-docs/references/core-style.md` | 4508 | 已读 |
| `skills/productivity/write-google-style-docs/references/official-sources.md` | 2680 | 已读 |
| `skills/productivity/write-google-style-docs/references/review-checklist.md` | 3694 | 已读 |
| `skills/productivity/write-google-style-docs/references/structure-and-procedures.md` | 4305 | 已读 |
| `skills/productivity/write-google-style-docs/references/technical-elements.md` | 6180 | 已读 |
| `skills/productivity/write-google-style-docs/references/word-choice.md` | 3024 | 已读 |
