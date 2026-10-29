# 来源与适用边界

本技能根据 Google 官方公开风格指南编写，核验日期为 **2026-10-28**。
保留规则含义、适用条件与例外，用中文重新组织为可执行条款和审查流程。
这是一份精选摘要，不是官方完整译本，也不是 Google 的背书或认证。

## 官方来源

| 文档 | 链接 | 在本技能中的用途 |
| --- | --- | --- |
| Google C++ Style Guide | [C++ 官方指南](https://google.github.io/styleguide/cppguide.html) | C++ 语言限制、组织、接口、命名与格式 |
| Go Style 总览 | [Go 官方入口](https://google.github.io/styleguide/go/) | 文档层级、术语与阅读关系 |
| Go Style Guide | [Go 核心指南](https://google.github.io/styleguide/go/guide) | canonical 且 normative 的原则与规则 |
| Go Style Decisions | [Go 风格决策](https://google.github.io/styleguide/go/decisions) | normative 的具体风格决策，服从核心指南 |
| Go Style Best Practices | [Go 最佳实践](https://google.github.io/styleguide/go/best-practices) | 非 canonical、非 normative 的辅助建议 |
| Google Python Style Guide | [Python 官方指南](https://google.github.io/styleguide/pyguide.html) | 语言用法、布局、注释、命名与类型注解 |
| Markdown style guide | [Markdown 官方指南](https://google.github.io/styleguide/docguide/style.html) | 文档结构、Markdown 源码和维护约定 |
| Google Style Guides 首页 | [范围与许可证](https://google.github.io/styleguide/#licensing) | Google 语境与上游许可说明 |
| Go 标准库 testing 文档 | [T.Context](https://pkg.go.dev/testing#T.Context) | 补充核对该 API 自 Go 1.24.0 引入及其语义，不扩充风格要求 |

各语言参考文件在对应章节提供更精确的官方锚点。
Go 入口不是全部规则；本技能一并阅读 Guide、Decisions 和 Best Practices。

## 规则解释原则

1.  保留原文中的明确要求、建议和允许事项，不把“prefer”“consider”“may”一概写成必须。
2.  Google 的规范服务于其代码和相关开源项目；外部项目采用时考虑已有工具链、
    标准版本、公共 API、第三方框架与兼容性要求。
3.  将本技能增加的检查命令、报告方式和跨平台适配标为工程实践。
    不把测试框架、formatter 默认值或内部包约定说成语言本身的要求。
4.  遵从用户明确选择的规范模式和适用仓库规则；发现实质冲突时解释取舍。
5.  摘要未覆盖的细节回查原文；不要以“未列出”推断“允许”或“禁止”。

## 版本与范围提醒

-   **C++：** 核验时官方基线为 C++20，并保留高版本与特定特性的限制。
    项目已有编译标准独立核实，摘要不是升级工具链的授权。
-   **Go：** 先检查 `go.mod` 及构建环境；一些原文示例可能依赖较新标准库。
    内部包或内部日志接口不能直接等同于 Go 标准库 API。
-   **Python：** 根据项目最低支持版本选择类型注解语法。
    “公开 API 应注解”与“模块内所有函数都必须注解”是不同要求。
-   **Markdown：** 用户提供的是仓库内 Markdown 风格指南。
    `[TOC]`、站点路径和 Gitiles 行为有宿主条件；本技能未声称覆盖全套技术写作指南。

## 更新方法

1.  打开上表中的原始官方链接，优先检查已有规则对应的章节。
2.  对版本、禁止事项、例外和条款强度做差异比较，不只更新页面日期。
3.  更新对应语言摘要与原创示例；保持既有编号可追溯。
4.  验证官方锚点、技能内部链接、示例语法与适用环境。
5.  更新本文件和入口中的核验日期，并说明重要变动。

## 署名与许可

上游作者为 **Google 及其贡献者**。Google Style Guides 首页说明：
规范文档采用 [Creative Commons Attribution 3.0 Unported（CC BY 3.0）](https://creativecommons.org/licenses/by/3.0/)，
上游代码示例采用 [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)。

本技能对规范正文进行了中文概括、重组、编号，并增加执行流程、例外提示和原创示例。
相关中文改编正文按 CC BY 3.0 提供；再分发时保留上游署名、来源链接、许可链接及改编说明。
代码示例为本次原创示例，未复制上游大段代码；不要据此暗示 Google 对本技能的认可。
