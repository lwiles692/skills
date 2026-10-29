# Go 开发规范

按 Google Go Style 的三个层级执行；先确认仓库已有规范和 `go.mod` 的 Go 版本。
核验日期：2026-10-28。本文件是中文归纳，来源与适用条件见各节链接；示例为本 skill 新写。

## 目录

-   [规则强度与适用范围](#规则强度与适用范围)
-   [基本原则与格式](#基本原则与格式)
-   [命名与导入](#命名与导入)
-   [注释与接口文档](#注释与接口文档)
-   [错误处理](#错误处理)
-   [数据、类型与函数](#数据类型与函数)
-   [Context 与并发](#context-与并发)
-   [接口与依赖](#接口与依赖)
-   [测试](#测试)
-   [最佳实践补充](#最佳实践补充)
-   [原创示例](#原创示例)
-   [交付前检查](#交付前检查)

## 规则强度与适用范围

| 来源层级 | 官方定位 | 如何使用 |
| --- | --- | --- |
| [Style Guide](https://google.github.io/styleguide/go/guide) | canonical、normative | 以稳定的核心规则和原则作判断依据 |
| [Style Decisions](https://google.github.io/styleguide/go/decisions) | normative，非 canonical | 用于具体审查裁决；与 Guide 冲突时以 Guide 为准 |
| [Best Practices](https://google.github.io/styleguide/go/best-practices) | 非 normative、非 canonical | 作为有条件的工程建议，不单凭这些建议阻断变更 |

下文“必须/禁止”描述选用 Google 风格后的明确要求；“建议/优先”保留裁量。
不要将 Google 的库选择、Bazel 布局或内部工具规定说成 Go 语言限制。
不要仅因指南更新就重写已有代码；对本次修改及相关问题渐进改进。
出处：[Overview](https://google.github.io/styleguide/go/)。

## 基本原则与格式

-   **GO-001【默认】**：按清晰、简单、精炼、可维护、一致的顺序权衡；不要为了少几行牺牲读者理解。先用语言内建能力，再考虑标准库、项目已有库，最后才增加抽象或依赖。
-   **GO-002【必须】**：Go 源文件遵循 `gofmt` 输出；生成代码通常也应格式化。不要手工构造与格式化器竞争的对齐方式。
-   **GO-003【默认】**：Go 没有固定代码行长上限。过长时优先重构表达式或 API；无法合理缩短则保留长行。不要为了凑列数拆字符串、函数声明或控制流条件。按语义分组拆复杂调用可以接受；提取条件时保留短路求值和副作用顺序。
-   **GO-004【默认】**：只有指南未规定的事项才由局部惯例决定。已有不一致可记录后续工作；不要借局部一致性扩大偏差、污染更多 API 或引入缺陷。

出处：[原则](https://google.github.io/styleguide/go/guide#style-principles)、
[最少机制](https://google.github.io/styleguide/go/guide#least-mechanism)、
[格式](https://google.github.io/styleguide/go/guide#formatting)、
[行长](https://google.github.io/styleguide/go/guide#line-length)、
[局部一致性](https://google.github.io/styleguide/go/guide#local-consistency)、
[条件格式](https://google.github.io/styleguide/go/decisions#conditional-formatting)。

## 命名与导入

-   **GO-005【默认】**：多词标识符使用 `MixedCaps` / `mixedCaps`；常量也一样，不用 `MAX_SIZE` 或 `kMaxSize`。导出性决定首字母大小写。文件名不受标识符的下划线限制；测试函数、生成代码相关包、少数系统互操作标识符有明确例外。
-   **GO-006【默认】**：包名简短、全小写，必要时包含数字；多词连写，避免 `util`、`common` 等无法说明职责的名字。外部测试包允许 `_test` 后缀；不要把普通代码包命名成下划线风格。
-   **GO-007【默认】**：保留首字母缩略词的惯用大小写，例如 `userID`、`HTTPClient`、`url`，不写 `userId`、`HttpClient`。`iOS`、`gRPC` 等混合大小写名称按原文和导出性规则处理，勿机械全大写。
-   **GO-008【必须】**：receiver 名短且反映类型，通常一两个字母，同一类型保持一致；不用 `this`、`self` 或 `_`。不用 receiver 时直接省略名称。
-   **GO-009【建议】**：变量名结合作用域和用途决定长度；短作用域可用 `i`、`r`、`w`，大作用域应能独立理解。避免重复包名、类型和已知上下文；getter 通常直接用名词，HTTP `Get` 等语义例外保留；耗时读取可用 `Fetch` 等动词。
-   **GO-010【默认】**：导入按标准库、其他项目/第三方包、Protocol Buffer 包、副作用导入分组，以空行分隔。组内排序交给工具；不要把 Go 通常的两组导入误写成 Google 的完整分组规则。
-   **GO-011【默认】**：通常不重命名导入；冲突、生成包的非法风格名称或明显改善可读性时再加别名，并在相关文件一致使用。Google protobuf 约定的消息包别名用 `pb` 后缀；不要把 Google 生成目标的路径规则强加给其他生成器。
-   **GO-012【必须 / 允许/例外】**：Google 风格禁用点导入 `import .`；副作用导入原则上只放 `main` 或需要它的测试。使用 `//go:embed` 时的 `_ "embed"` 是明确例外。不要为了规避依赖管理而给通用库增加隐式注册。

出处：[MixedCaps](https://google.github.io/styleguide/go/guide#mixed-caps)、
[命名](https://google.github.io/styleguide/go/decisions#naming)、
[缩略词](https://google.github.io/styleguide/go/decisions#initialisms)、
[receiver](https://google.github.io/styleguide/go/decisions#receiver-names)、
[导入分组](https://google.github.io/styleguide/go/decisions#import-grouping)、
[导入别名](https://google.github.io/styleguide/go/decisions#import-renaming)、
[副作用导入](https://google.github.io/styleguide/go/decisions#import-blank)、
[点导入](https://google.github.io/styleguide/go/decisions#import-dot)。

## 注释与接口文档

-   **GO-013【必须】**：所有顶层导出名称有文档注释；行为不明显的未导出类型和函数也应说明。文档用完整句，通常从被说明的符号名开始，写给调用者而非只写给实现者。
-   **GO-014【必须】**：每个包只有一处包文档，紧邻 `package` 子句且中间无空行。可放在 `doc.go`；`main` 包说明命令用途。Google `BUILD` 名称的要求仅适用于对应构建体系。
-   **GO-015【建议】**：解释原因、约束和容易误读之处，不复述代码。注释也没有硬性行长；可按 80 或 100 列附近折行并保持文件一致，完整 URL 等例外保留。
-   **GO-016【建议】**：在测试文件放可运行 `Example`，并检查生成文档。明确非显然的零值、并发安全、清理责任、错误类别及取消行为；不要把示例中的特殊前提当成推荐 API 设计。
-   **GO-017【默认】**：结果命名应帮助区分同类型返回值或表达调用者责任，例如 `cancel`；不要为少声明变量或使用裸 `return` 而命名结果。裸返回仅适合很短的函数；`defer` 需要修改结果时可命名。

出处：[文档注释](https://google.github.io/styleguide/go/decisions#doc-comments)、
[包注释](https://google.github.io/styleguide/go/decisions#package-comments)、
[注释行长](https://google.github.io/styleguide/go/decisions#comment-line-length)、
[示例](https://google.github.io/styleguide/go/decisions#examples)、
[结果命名](https://google.github.io/styleguide/go/decisions#named-result-parameters)、
[文档惯例（最佳实践）](https://google.github.io/styleguide/go/best-practices#documentation-conventions)。

## 错误处理

-   **GO-018【默认】**：用末位 `error` 返回可失败操作，成功返回 `nil`。导出 API 返回 `error` 接口，避免以具体错误指针作返回类型造成 typed-nil 陷阱。
-   **GO-019【默认】**：除非 API 明确保证部分结果可用，`err != nil` 时其他返回值视为未定义；不要假设一定是零值，也不要继续消费它们。
-   **GO-020【默认】**：对错误明确选择处理、返回，或在确有必要的顶层终止程序。通常不能用 `_` 丢弃错误；确实永不失败或可安全忽略时，用注释说明理由。
-   **GO-021【默认】**：错误字符串通常小写开头、无结尾标点；导出名、专有名词、缩略词例外。最终日志、测试失败信息和 UI 消息按完整消息的语法处理。
-   **GO-022【默认】**：先处理错误并返回，使成功路径保持较少缩进；终止分支后不再包多余 `else`。用额外的 `error` 或 `ok` 表达失败/缺失，不滥用 `-1`、空字符串或 `nil` 作为业务值中的错误暗号。
-   **GO-023【必须 / 允许/例外】**：普通错误不用 `panic`。`MustXYZ` 适用于启动期固定输入或适当测试构造，不用于请求输入。极少数包内解析等实现可配对使用受控 `panic/recover`，必须在包边界转换为错误并重新抛出无关 panic；不要宽泛恢复未知 panic 后继续运行。
-   **GO-024【建议】**：补充错误上下文时只增加新信息。需要让调用者通过 `errors.Is/As` 识别底层错误时用 `%w`；只保留描述或转换错误空间时可用 `%v`。暴露可解包错误属于 API 承诺，不能把“所有包装一律 `%w`”当规则。`%w` 通常放末尾；突出 sentinel 分类时可放开头。
-   **GO-025【建议】**：需要程序化分类的错误使用 sentinel、错误类型或合适错误码，不靠解析 `err.Error()`。返回错误的函数通常交由上层决定记录，避免每层重复打印；日志保留定位信息并避免泄露敏感数据。

出处：[返回错误](https://google.github.io/styleguide/go/decisions#returning-errors)、
[错误字符串](https://google.github.io/styleguide/go/decisions#error-strings)、
[处理错误](https://google.github.io/styleguide/go/decisions#handle-errors)、
[错误路径](https://google.github.io/styleguide/go/decisions#indent-error-flow)、
[带内错误](https://google.github.io/styleguide/go/decisions#in-band-errors)、
[panic](https://google.github.io/styleguide/go/decisions#dont-panic)、
[Must](https://google.github.io/styleguide/go/decisions#must-functions)、
[错误结构](https://google.github.io/styleguide/go/best-practices#error-structure)、
[补充错误信息](https://google.github.io/styleguide/go/best-practices#error-extra-info)、
[%w 位置](https://google.github.io/styleguide/go/best-practices#error-percent-w)、
[记录错误](https://google.github.io/styleguide/go/best-practices#error-logging)、
[panic 例外](https://google.github.io/styleguide/go/best-practices#when-to-panic)。

## 数据、类型与函数

-   **GO-026【必须 / 建议】**：初始化其他包的 struct 时必须写字段名；本包类型可省略，但字段多、同类型相邻或测试表较长时优先命名。可省去不影响理解的零值字段；若零值就是测试重点则显式写出。
-   **GO-027【建议】**：空切片局部变量优先 `var items []T`。API 不应强迫调用者区分 nil 与长度为零的切片；判断空通常用 `len(items) == 0`。这不是说两种切片在编码协议中一定相同；协议输出要求应单独处理。
-   **GO-028【工程实践】**：nil map 可以读取，但写入前须初始化。零值已经足够时不必逐字段赋零；知道初始数据时用复合字面量。后两项属于最佳实践，不构成统一禁止 `new(T)` 或 `&T{}` 的规则。
-   **GO-029【默认】**：不要复制已使用的锁或含不可复制字段的对象；对 `bytes.Buffer` 等有别名风险的类型按 API 契约处理。包含这类成员的结构体通过指针传递并使用指针 receiver，注意值 receiver 也会隐式复制。
-   **GO-030【默认】**：receiver 需要修改自身、含不可安全复制成员或通常很大时用指针；小型不可变值可用值 receiver。同类型的方法尽量保持一致。不要只为省少量字节给字符串、接口等加指针；真实性能问题用测量判断。
-   **GO-031【默认】**：允许按真实需求使用泛型；不要为目前只有一种实例类型的代码提前抽象，不用泛型发明错误处理或测试 DSL。导出泛型 API 应有清晰文档，建议有动机明确的可运行示例。
-   **GO-032【默认 / 版本条件】**：在支持 Go 1.18+ 的新代码中优先 `any`；不要仅为了风格修改模块最低版本。类型别名主要用于迁移等确实需要保持类型身份的场景，不随意代替新类型定义。
-   **GO-033【默认】**：比较表达式把变量放左边；`switch` 的 case 末尾不加多余 `break`。需要跳出外层循环时使用适当标签，不能误以为 switch 内的普通 `break` 会结束循环。

出处：[复合字面量](https://google.github.io/styleguide/go/decisions#literal-formatting)、
[nil 切片](https://google.github.io/styleguide/go/decisions#nil-slices)、
[零值（最佳实践）](https://google.github.io/styleguide/go/best-practices#vardeclzero)、
[复制](https://google.github.io/styleguide/go/decisions#copying)、
[receiver 类型](https://google.github.io/styleguide/go/decisions#receiver-type)、
[值传递](https://google.github.io/styleguide/go/decisions#pass-values)、
[泛型](https://google.github.io/styleguide/go/decisions#generics)、
[any](https://google.github.io/styleguide/go/decisions#use-any)、
[类型别名](https://google.github.io/styleguide/go/decisions#type-aliases)、
[switch](https://google.github.io/styleguide/go/decisions#switch-break)。

## Context 与并发

-   **GO-034【默认】**：显式传递的 `context.Context` 放第一参数，测试 helper 也一样。HTTP handler、流式 RPC 等既定签名从请求/流取 context；当前指南建议测试从 `t.Context()` 获取，但该能力需要 Go 1.24+。
-   **GO-035【默认】**：沿调用链传递调用者的 context，通常只在 `main`、初始化等入口创建根 context；库函数不要随意以 `context.Background()` 丢掉取消、deadline 和追踪信息。确实要脱离生命周期时说明原因并依据项目支持版本设计。
-   **GO-036【必须 / 允许/例外】**：不要自定义替代 `context.Context` 的接口；一般不把 context 存入 struct，包括 Options。必须匹配标准库或外部库不可更改的方法签名时有窄例外，需要说明生命周期和限制。
-   **GO-037【建议】**：实现可响应取消的 API，并明确与通常语义不同的取消结果、后台退出时机和清理责任；获取取消函数或资源后安排相应清理。传了 context 并不自动意味着底层操作可中断。
-   **GO-038【必须】**：启动 goroutine 时明确其退出条件、取消路径和等待责任；特别检查 channel 阻塞导致的泄漏、关闭后发送以及遗留任务访问共享数据。垃圾回收不会终止阻塞 goroutine。
-   **GO-039【建议】**：优先提供同步函数，让调用者决定是否并发；把并发编排限制在清晰作用域内。`Wait` 本身不能解决工作函数无法停止的问题，必须同时设计退出途径。
-   **GO-040【建议】**：尽量在参数/返回值写明 channel 方向；例如消费端用 `<-chan T`，帮助编译器限制错误发送或关闭。并发性能改进应基于测量，不凭指针、缓存或预分配的直觉推断。

出处：[Contexts](https://google.github.io/styleguide/go/decisions#contexts)、
[T.Context 版本与语义](https://pkg.go.dev/testing#T.Context)、
[自定义 context](https://google.github.io/styleguide/go/decisions#custom-contexts)、
[goroutine 生命周期](https://google.github.io/styleguide/go/decisions#goroutine-lifetimes)、
[同步函数](https://google.github.io/styleguide/go/decisions#synchronous-functions)、
[取消文档（最佳实践）](https://google.github.io/styleguide/go/best-practices#documentation-conventions-contexts)、
[清理文档（最佳实践）](https://google.github.io/styleguide/go/best-practices#documentation-conventions-cleanup)、
[channel 方向（最佳实践）](https://google.github.io/styleguide/go/best-practices#decl-chan)。

## 接口与依赖

-   **GO-041【默认】**：等到真实需求出现再定义小接口，只列使用者需要的方法；仅包内使用就不导出。不要因为名称是 Service/Repository 就自动加一层接口，也不要只为测试重包已生成的 RPC 客户端。
-   **GO-042【默认 / 允许/例外】**：接口通常由消费方定义；接口本身就是共享协议产品、需要避免大量重复定义等情形，可由提供方公开。优先接受必要接口、返回具体类型；错误、合理封装和运行时多实现等情况允许返回接口。
-   **GO-043【默认 / Google 语境】**：flag 原则上只在 `main` 或等效入口定义；通用库通过参数/配置获得依赖。原文 `log.Info`、`log.Exit`、`log.Fatal` 指 Google 日志变体，不能直接当作 Go 标准库 `log` 的 API 或语义；采用项目现有日志设施。
-   **GO-044【必须】**：生成密钥等安全随机数据用 `crypto/rand`，不用 `math/rand`。按目标 Go 版本和调用 API 的返回契约处理错误，不复制不兼容的旧示例。

出处：[接口](https://google.github.io/styleguide/go/decisions#interfaces)、
[接口归属与例外（最佳实践）](https://google.github.io/styleguide/go/best-practices#interface-ownership-and-visibility)、
[返回接口（最佳实践）](https://google.github.io/styleguide/go/best-practices#designing-effective-interfaces)、
[Flags](https://google.github.io/styleguide/go/decisions#flags)、
[Logging](https://google.github.io/styleguide/go/decisions#logging)、
[安全随机](https://google.github.io/styleguide/go/decisions#crypto-rand)。

## 测试

-   **GO-045【默认 / Google 语境】**：Google 代码使用标准库 `testing` 作为测试框架，不使用断言库/第三方测试框架；不要自建隐藏失败语境的 assertion DSL。应用到其他仓库时先报告与现有框架的差异，不擅自迁移整个测试体系。
-   **GO-046【默认】**：失败信息说明被测函数、相关输入、实际值和期望值，通常实际值在前。复杂结果可比较完整结构并输出差异，明确 `-want +got` 等方向；不要只报测试表行号。
-   **GO-047【默认】**：优先验证错误有无或 `errors.Is/As` 等语义；不靠完整错误字符串匹配判断错误种类。只在文案本身是约定时检查文案；JSON 等非承诺稳定的编码结果通常解析后按语义比较。
-   **GO-048【默认】**：相似逻辑适合表驱动；不同流程不强塞同一张表。子测试应能单独运行，不依赖其他 case 的状态或顺序；名字应便于输出和命令行过滤。并非所有测试都必须表驱动或使用 `t.Run`。
-   **GO-049【默认】**：普通不匹配优先 `t.Error` 以收集更多问题；缺少前置条件或后续判断无意义时用 `t.Fatal`。只可从当前测试/子测试的 goroutine 调 `t.Fatal`、`FailNow`；工作 goroutine 应返回错误或记录非致命失败后退出，并在测试结束前等待完成。
-   **GO-050【默认 / 建议】**：接收 `*testing.T` 的 setup/cleanup helper 调 `t.Helper()`；context 若存在仍在第一位。复用验证逻辑可返回值/错误，由测试主体决定失败。清理可使用 `t.Cleanup`；不要用 helper 掩盖被测行为及诊断信息。
-   **GO-051【默认】**：复杂比较优先选择符合语义的比较工具；文中的 `cmp.Equal/Diff` 来自 `github.com/google/go-cmp/cmp`，不是标准库 `cmp`。protobuf 需要适当 `protocmp` 选项；这些测试比较器不应直接当生产逻辑。`cmp.Diff` 的参数顺序没有统一硬规定，但失败信息必须说明方向。

出处：[testing](https://google.github.io/styleguide/go/decisions#use-package-testing)、
[断言库](https://google.github.io/styleguide/go/decisions#assert)、
[有效失败信息](https://google.github.io/styleguide/go/decisions#useful-test-failures)、
[错误语义](https://google.github.io/styleguide/go/decisions#test-error-semantics)、
[稳定结果](https://google.github.io/styleguide/go/decisions#compare-stable-results)、
[表驱动](https://google.github.io/styleguide/go/decisions#table-driven-tests)、
[子测试](https://google.github.io/styleguide/go/decisions#subtests)、
[继续检查](https://google.github.io/styleguide/go/decisions#keep-going)、
[测试 helper](https://google.github.io/styleguide/go/decisions#mark-test-helpers)、
[比较](https://google.github.io/styleguide/go/decisions#types-of-equality)、
[Fatal 的 goroutine 限制](https://google.github.io/styleguide/go/best-practices#t-fatal-goroutine)。

## 最佳实践补充

以下四条只作为场景化建议，勿升级为未经项目采用的门禁。

-   **GO-052【建议】**：将可变状态封装为实例并显式传依赖，使测试隔离。全局状态并非全部禁止：逻辑常量、观察上无状态的内部缓存等可合理使用；默认全局实例也应同时提供可隔离实例 API。
-   **GO-053【建议】**：参数过多时先考虑简化 API，再考虑 Options struct；functional options 只在其灵活性值得额外复杂度时使用。不要把 context 藏在 Options 中。
-   **GO-054【建议】**：按职责组织包和文件，不规定“一类型一文件”。已知大小或测量证明有收益时可预分配，但不是所有切片/map 都必须预分配；非零局部初始化通常用 `:=`，零值声明保持清楚即可。
-   **GO-055【建议】**：少量简单字符串拼接用 `+`，复杂格式用 `fmt.Sprintf`，循环逐步构建用 `strings.Builder`；直接写 `io.Writer` 时可用 `fmt.Fprintf`。测试 HTTP/RPC 集成时优先真实客户端/传输连接测试服务，避免手写客户端替身偏离真实语义。

出处：[全局状态](https://google.github.io/styleguide/go/best-practices#globals)、
[参数列表](https://google.github.io/styleguide/go/best-practices#funcargs)、
[包大小](https://google.github.io/styleguide/go/best-practices#package-size)、
[预分配](https://google.github.io/styleguide/go/best-practices#vardeclsize)、
[字符串](https://google.github.io/styleguide/go/best-practices#string-concat)、
[真实传输](https://google.github.io/styleguide/go/best-practices#use-real-transports)、
[未统一规定的事项](https://google.github.io/styleguide/go/decisions#non-decisions)。

## 原创示例

此示例公开一个可用 `errors.Is(err, ErrPort)` 识别的分类错误；输入细节只补充到消息。
这里将 `%w` 放在开头是为了先显示 sentinel 分类，符合上述明确例外。

```go
// Package config 解析应用配置值。
package config

import (
	"errors"
	"fmt"
	"strconv"
)

// ErrPort 表示无效的 TCP 端口。
var ErrPort = errors.New("invalid port")

// ParsePort 解析范围为 1 到 65535 的十进制 TCP 端口。
// text 无效时，返回包装 ErrPort 的错误。
func ParsePort(text string) (int, error) {
	port, err := strconv.Atoi(text)
	if err != nil || port < 1 || port > 65535 {
		return 0, fmt.Errorf("%w: %q", ErrPort, text)
	}
	return port, nil
}
```

## 交付前检查

以下为本 skill 的执行建议，不是 Google 原文规定的一套固定 CI 命令。

1.  先读 `go.mod`、生成规则、现有格式/测试脚本与任务涉及包；不得为使用新 API 擅自升级 Go。
2.  对修改文件检查 `gofmt`，再运行项目已配置的静态检查及受影响包测试；模块仓库可按范围选 `go test`、`go vet`，Bazel 仓库沿用相应目标。
3.  改到并发行为且环境支持时，按风险运行对应范围的 race 检查；核对取消、等待、channel 关闭和共享状态。
4.  分别报告明确违规、建议、项目约定差异；涉及例外时给出规则 ID 和来源，不能只写“Go 不允许”。
5.  未运行的检查明确写明原因；格式化通过不代表生命周期、错误契约或行为测试已通过。
