# Markdown 文档规范

依据 [Google Markdown style guide][guide] 的中文整理，核验日期为 2026-10-28。
适用于技术文档、README、设计说明与 API 使用说明。它是 Markdown 源文件与文档维护规范，
不是 Google 全套技术写作指南。标签含义见技能入口。

## 目录

-   [维护与文档结构](#维护与文档结构)
-   [标题与段落](#标题与段落)
-   [列表](#列表)
-   [代码与命令](#代码与命令)
-   [链接](#链接)
-   [图片表格与可移植性](#图片表格与可移植性)
-   [原创示例](#原创示例)
-   [审查要点](#审查要点)

## 维护与文档结构

-   **DOC-001【建议】保持最小且有效的文档集。** 优先维护准确、需要的内容，
    随功能变更更新说明；清理过时与重复资料，避免扩大失修文档规模。
-   **DOC-002【建议】接受有价值的小幅改善。** 提供具体替代写法；与本次改进无关的大改动
    留给后续任务。文档变得更差或出现事实错误时才据此阻断，不用追求完美拖延合理改进。
-   **DOC-003【默认】采用清晰骨架。** 一个一级标题、1–3 句导言、需要时的目录、
    从二级标题开始的正文，以及可选的相关资料。标题应尽量对应文件主题。
-   **DOC-004【默认／平台条件】在支持的宿主上使用 `[TOC]`。** 内容超过一个屏幕时，
    目录放在导言之后、首个二级标题之前，保留屏幕阅读器和键盘访问的正确阅读顺序。
    Gitiles 支持该指令；其他平台须先确认支持情况。
    **【工程实践】** 不支持时改用平台目录或普通锚点列表，不能留下不会渲染的占位符。

依据：[最小文档集][minimal]、[渐进改进][better]、[文档布局][layout]、[目录][toc]。

## 标题与段落

-   **DOC-005【必须】保留产品与工具的正式大小写。** 使用 `Markdown`、`Python`、
    `GitHub` 等正确名称；不要为统一视觉样式改写产品名。
-   **DOC-006【默认】使用 ATX 标题。** 使用 `#`、`##`、`###`；避免以 `===` 或 `---`
    下划线模拟标题。`#` 后留空格，标题前后留空行。
-   **DOC-007【必须】正文仅有一个 H1 文档标题。** 后续章节使用 H2 及更深层级。
    **【工程实践】** 检查模板自动生成的页面标题，避免与正文 H1 重复。
-   **DOC-008【默认】标题独特、完整、可理解。** 避免重复使用无上下文的“示例”“总结”
    作为多个小节标题，以便目录和自动锚点准确表达目标内容。
-   **DOC-009【默认】普通正文以 80 字符为换行目标。** 链接、标题、表格和代码块可超长；
    链接前后的普通文字仍正常换行。代码块按对应语言规则处理。
    **【工程实践】** 中文和全角字符按仓库 formatter 的实际规则执行，不用字节数判断列宽。
-   **DOC-010【必须】不依赖行尾空格。** 去除尾随空格；通常用空行分段。
    **【允许／例外】** 确实需要段内换行时，少量使用行尾反斜杠并检查目标渲染器效果。
-   **DOC-011【默认】按技术写作的标题大小写约定处理英文标题。** 原文将具体规范委托给
    Google Developer Documentation Style Guide；仅在任务涉及英文标题时查该官方链接，
    不从此 Markdown 页面臆造一套未载明的细则。

依据：[大小写][capitalization]、[标题][headings]、[行长及例外][length]、[尾随空白][whitespace]。

## 列表

-   **DOC-012【工程实践】按是否有顺序选择列表。** 过程使用有序列表，平行项目使用无序列表。
    与上下文保持空行分隔，以便不同 Markdown 渲染器稳定解析。
-   **DOC-013【建议】长且经常变动的有序列表可以全部写 `1.`。** 简短、稳定列表优先写出
    完整序号，提升源文件可读性；不要把“懒编号”推广成所有列表的强制要求。
-   **DOC-014【默认】嵌套列表每层缩进 4 个空格。** `1.` 后放 2 个空格、项目符号后放
    3 个空格，使正文从第 5 列开始；续行与正文对齐。
    **【允许／例外】** 简短、无嵌套、单行的列表，标记后 1 个空格即可。
-   **DOC-015【必须】列表中的代码块保留父列表缩进。** 让 fenced code block 归属正确项目，
    防止代码块意外结束列表或重置序号。

依据：[列表与编号][lists]、[嵌套列表间距][nested]、[列表内代码块][nestedcode]。

## 代码与命令

-   **DOC-016【默认】用行内代码表示标识符。** 字段名、命令、短代码、泛指的文件名与
    文件类型用反引号；提到具体可访问的文件时可用有含义的链接。
-   **DOC-017【默认】用代码跨度阻止误解析。** 示例路径、伪 URL、包含 Markdown
    特殊符号的文字用反引号包裹，避免意外自动链接或格式变化。
-   **DOC-018【建议】多行代码优先使用围栏代码块。** 避免仅以四空格缩进表示代码，
    因为围栏边界清楚且便于声明语言。
-   **DOC-019【建议】明确代码块语言。** 使用 `cpp`、`go`、`python`、`bash`、`json`、
    `markdown` 等适合目标渲染器的标识；普通输出使用 `text`。
-   **DOC-020【默认】多行 shell 命令可直接复制。** 换行需要 shell 续行时在行尾使用 `\`，
    反斜杠后不留空格。**【工程实践】** 将提示符与输出区分，说明需替换的占位符；
    不把危险命令伪装成无副作用的示例。

依据：[行内代码][inline]、[代码转义][escape]、[代码块][codeblocks]、[命令续行][newlines]。

## 链接

-   **DOC-021【默认】使用明确的文档路径。** 在支持该路由的文档站点，使用明确路径，
    同目录文件可用 `other.md`；避免难维护的多级 `../../`。
    **【工程实践】** 可移植技能包采用包内相对路径；仓库文档按其实际渲染位置选择路径。
    不把站点根 `/path/page.md` 机械套到离线目录或不同部署前缀。
-   **DOC-022【必须】链接文字描述目的地。** 使用“部署说明”“错误码参考”之类的短语，
    不用“这里”“链接”或重复裸 URL 代替说明。
-   **DOC-023【建议】长链接或重复链接使用引用式链接。** 普通短链接无需刻意拆为引用；
    表格中可更积极使用引用，减少单元格宽度。
-   **DOC-024【建议】引用定义靠近首次使用章节的末尾。** 放在下个标题之前；
    跨多个章节共享的定义可统一置于文末。格式化工具有既定行为时遵循工具。
-   **DOC-025【工程实践】检查相对路径、锚点与目标可达性。** 重命名标题或移动文档后检查
    引用方；区分无法联网与实际断链，不在网络失败时断言链接不存在。

依据：[明确路径][paths]、[相对路径][relative]、[链接文字][titles]、[引用式链接][references]。

## 图片表格与可移植性

-   **DOC-026【建议】图片用于能显著改善理解的内容。** UI 操作等内容可以配图，
    简单截图通常比装饰性图片更有效；文字能够清楚说明时不必堆放图片。
-   **DOC-027【必须】为有信息的图片提供相应文本说明。** 让无法看见图像的读者也能
    理解其要点；避免仅写“图片”作为替代文本。
-   **DOC-028【建议】只用表格表达适合二维对比的数据。** 表头明确、内容精炼；
    少数几行却有大量列、空值很多或单元格包含长段落时，改用列表与小标题。
-   **DOC-029【建议】优先标准 Markdown，避免 HTML 技巧。** HTML 会降低源文本可读性和
    可移植性；Gitiles 不渲染 HTML。确需复杂布局时先确认平台能力和实际收益。
-   **DOC-030【工程实践】在实际目标平台检查效果。** 至少检查标题层级、列表连续性、
    代码高亮、图片替代文本、链接和窄窗口可读性；源文件看起来正确不等于渲染正确。

依据：[图片][images]、[表格][tables]、[Markdown 与 HTML][html]。

## 原创示例

以下是适用于支持普通锚点链接的 Markdown 渲染器的精简文档片段。
真实项目需替换标题、命令与路径；目录较长时采用平台支持的自动目录。

````markdown
# 批量导入工具

这个工具将 UTF-8 编码的数据文件导入测试环境。先准备输入文件，再运行导入命令。

## 导入数据

1.  检查输入文件是否符合 [数据格式说明](input-format.md)。
2.  执行导入。

    ```bash
    python -m importer \
      --input ./sample.csv \
      --dry-run
    ```

## 查看导入结果

命令输出已处理数量与失败原因。根据错误提示修正输入后重新执行。
````

## 审查要点

-   确认读者从标题与导言就能理解文档目的，说明与实际功能一致。
-   区分正文行长规则与链接、标题、表格、代码块例外。
-   确认目录指令、路径和 HTML 适配目标平台。
-   检查命令可复制、列表不被代码块打断、链接文字和图片文本有信息。
-   接受改进范围合理的小修订，不附带无关大规模重写。

[guide]: https://google.github.io/styleguide/docguide/style.html
[minimal]: https://google.github.io/styleguide/docguide/style.html#minimum-viable-documentation
[better]: https://google.github.io/styleguide/docguide/style.html#better-is-better-than-best
[layout]: https://google.github.io/styleguide/docguide/style.html#document-layout
[toc]: https://google.github.io/styleguide/docguide/style.html#table-of-contents
[capitalization]: https://google.github.io/styleguide/docguide/style.html#capitalization
[headings]: https://google.github.io/styleguide/docguide/style.html#headings
[length]: https://google.github.io/styleguide/docguide/style.html#character-line-limit
[whitespace]: https://google.github.io/styleguide/docguide/style.html#trailing-whitespace
[lists]: https://google.github.io/styleguide/docguide/style.html#lists
[nested]: https://google.github.io/styleguide/docguide/style.html#nested-list-spacing
[nestedcode]: https://google.github.io/styleguide/docguide/style.html#nest-codeblocks-within-lists
[inline]: https://google.github.io/styleguide/docguide/style.html#inline
[escape]: https://google.github.io/styleguide/docguide/style.html#use-code-span-for-escaping
[codeblocks]: https://google.github.io/styleguide/docguide/style.html#codeblocks
[newlines]: https://google.github.io/styleguide/docguide/style.html#escape-newlines
[paths]: https://google.github.io/styleguide/docguide/style.html#use-explicit-paths-for-links-within-markdown
[relative]: https://google.github.io/styleguide/docguide/style.html#avoid-relative-paths-unless-within-the-same-directory
[titles]: https://google.github.io/styleguide/docguide/style.html#use-informative-markdown-link-titles
[references]: https://google.github.io/styleguide/docguide/style.html#reference
[images]: https://google.github.io/styleguide/docguide/style.html#images
[tables]: https://google.github.io/styleguide/docguide/style.html#tables
[html]: https://google.github.io/styleguide/docguide/style.html#strongly-prefer-markdown-to-html
