# C++ 开发规范

依据 [Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html)，
核验日期：2026-10-28。以下是中文改编摘要与原创示例，上游作者为 Google，
上游文档按 CC BY 3.0 许可发布；适用于选择 Google C++ 规范的项目；其中的 Google 特定限制不是 C++ 语言本身的限制。
先按主 skill 确认项目配置、版本、既有接口及适用范围，再执行对应条款。

## 目录

-   [版本与适用范围](#版本与适用范围)
-   [头文件与依赖](#头文件与依赖)
-   [作用域与生命周期](#作用域与生命周期)
-   [类与接口设计](#类与接口设计)
-   [函数与参数](#函数与参数)
-   [错误处理与类型转换](#错误处理与类型转换)
-   [类型与表达式](#类型与表达式)
-   [现代语言特性](#现代语言特性)
-   [命名注释与排版](#命名注释与排版)
-   [原创示例](#原创示例)
-   [交付前检查](#交付前检查)

## 版本与适用范围

-   **CPP-001｜【必须】**：以本次核验时的 **C++20** 为 Google 规范基线，
    不使用 C++23 特性。先核对项目编译选项与目标平台；不要仅为统一风格
    擅自升级旧项目的语言版本。[来源：C++ Version][version]
-   **CPP-002｜【允许/例外】**：修改既有非 Google 风格代码时，可以遵循局部约定。
    【工程实践】记录影响接口兼容性或全项目约定的差异，不把一次业务修改
    扩大为全仓迁移。[来源：Existing Non-conformant Code][existing]
-   **CPP-003｜【必须】【允许/例外】**：禁止直接依赖非标准扩展；允许使用项目统一的
    可移植性封装。Windows 的导入导出等必要扩展按原文专门例外处理，不能
    据此普遍放开 `#pragma`、变长数组或内联汇编。[来源：Nonstandard Extensions][extensions]
-   **CPP-004｜【建议】**：选库时先沿用项目解决同类问题的既有库。原文在没有
    既有选择时，依次偏好 Abseil、允许使用的标准库、项目内已有库、其他库。
    这是 Google 的选库偏好，不是给所有项目强制增加 Abseil 依赖。
    [来源：Third-party Libraries][libraries]

## 头文件与依赖

-   **CPP-005｜【必须】【允许/例外】**：实现文件采用 `.cc`，头文件采用 `.h`；一般一份
    实现对应一份头文件。仅包含 `main()` 的小文件与测试文件可没有对应头文件。
    非自包含的文本包含片段使用 `.inc`，并限制使用。
    [来源：Header Files][headers]
-   **CPP-006｜【必须】**：头文件可以独立编译，自己包含依赖并提供
    `#ifndef` / `#define` 保护；保护名根据项目及路径生成，例如
    `ACME_NET_REQUEST_OPTIONS_H_`。不要用 `#pragma once` 替代 Google
    的头文件保护要求。[来源：Self-contained Headers][self-contained]、[The #define Guard][guard]
-   **CPP-007｜【必须】**：每个 `.cc` / `.h` 直接包含提供其所用符号的头文件，
    不依赖传递包含；实现文件不能因为自己的头文件已包含某依赖就省略它。
    同时删除不再需要的直接依赖。[来源：Include What You Use][iwyu]
-   **CPP-008｜【必须】【允许/例外】**：不手写本项目不拥有的实体的前置声明，尤其不能
    在 `std` 内自行声明类型。对本项目实体，先降低头文件编译成本；确有
    编译成本理由时，可以审慎采用前置声明。[来源：Forward Declarations][forward]
-   **CPP-009｜【建议】【必须】**：公开声明处只保留短函数定义，约 10 行是判断
    提示而非计数器。长实现移至 `.cc`；模板等必须保留在头文件中的实现，
    放在内部区域并保证 ODR 安全。不拆成要求调用者额外包含的 `-inl.h`。
    [来源：Defining Functions in Header Files][header-functions]
-   **CPP-010｜【必须】**：包含顺序为：对应头文件、C 系统及带 `.h` 的尖括号
    头文件、C++ 标准库头文件、其他库头文件、项目头文件。非空组之间空一行，
    组内按字母排序；局部平台条件包含可按原文例外后置。
    [来源：Names and Order of Includes][include-order]
-   **CPP-011｜【必须】**：项目头文件使用从项目源码根目录出发的路径，避免
    `.` / `..`。仅对要求尖括号的库采用 `<...>`，其余使用引号；不要
    把所有第三方头文件一概改成尖括号。[来源：Names and Order of Includes][include-order]

## 作用域与生命周期

-   **CPP-012｜【必须】**：使用可辨识且避免冲突的项目命名空间，不使用
    `using namespace` 指令或 inline namespace。头文件的命名空间别名
    只放在明确内部区域等允许位置；不要泄漏便利别名成为公开 API。
    命名空间关闭处添加说明其名称的注释。
    [来源：Namespaces][namespaces]
-   **CPP-013｜【必须】**：仅在 `.cc` 内使用的自由函数和变量采用匿名命名空间
    或内部链接的 `static`；不要在 `.h` 中这样做。这里不等于禁止头文件
    声明类的静态成员。[来源：Internal Linkage][internal]
-   **CPP-014｜【建议】**：局部变量放在最小合理作用域，接近首次使用处声明并
    初始化。循环中的昂贵构造有实际影响时，考虑复用对象，仍需保持状态正确。
    [来源：Local Variables][locals]
-   **CPP-015｜【必须】【允许/例外】**：静态存储期对象必须满足原文的平凡析构限制；
    非局部动态初始化通常禁止，仅在不依赖任何初始化先后顺序时例外允许。
    常量初始化用 `constexpr` / `constinit` 表达；函数局部静态变量可以
    动态初始化，但不因此豁免析构规则。不要给静态 `std::string` 或智能
    指针误判为合规。[来源：Static and Global Variables][static]
-   **CPP-016｜【必须】【建议】**：类或命名空间作用域的 `thread_local` 必须
    常量初始化，并用 `constinit` 或适用的 `constexpr` 保证。函数局部
    `thread_local` 可动态初始化；审查线程退出时的析构顺序及对象引用，
    优先使用简单且无危险析构行为的类型。[来源：thread_local][thread-local]
-   **CPP-017｜【建议】**：优先值语义和明确的单一所有者；必须动态分配时，优先
    让分配方持有所有权。用 `std::unique_ptr` 表达独占所有权转移，借用访问
    使用不转移所有权的引用或指针；检查借用者不会超出对象生命周期。
    [来源：Ownership and Smart Pointers][ownership]
-   **CPP-018｜【建议】【必须】**：仅在有充分设计理由时采用共享所有权，明确循环
    引用、成本与释放时机。原文给出的避免昂贵复制场景要求收益显著且对象不可变；
    这不是所有共享场景都只能使用 `shared_ptr<const T>` 的绝对规则。
    不使用 `std::auto_ptr`。[来源：Ownership and Smart Pointers][ownership]

## 类与接口设计

-   **CPP-019｜【必须】【建议】**：构造函数不调用虚函数，不把无法报告的可恢复失败
    藏在构造中；必要时使用能返回错误的工厂。避免创建只有额外 `Init()` 成功
    后才可使用的半初始化对象。[来源：Doing Work in Constructors][constructors]
-   **CPP-020｜【必须】【允许/例外】**：可用单个实参调用的构造函数及转换运算符加
    `explicit`；拷贝/移动构造函数及单参数 `std::initializer_list`
    构造函数例外。刻意互换表示形式的隐式转换需按项目既有豁免处理。
    [来源：Implicit Conversions][implicit]
-   **CPP-021｜【必须】【允许/例外】**：公开接口明确类型是否可拷贝、仅可移动或两者
    都不可；通常显式声明或删除相关操作，提供赋值操作时同时提供对应构造。
    无私有区域、或继承明确不可拷贝/移动的基类等显然情形可以省略；不要机械
    要求所有类型必须手写五个特殊成员。[来源：Copyable and Movable Types][copy]
-   **CPP-022｜【必须】【建议】**：`struct` 用于公开字段的被动数据，不承担字段间
    不变量；有不变量或持续演化的接口用 `class`，普通类数据成员私有。
    字段有明确含义时优先命名 `struct`，避免用 pair/tuple 隐藏语义。
    [来源：Structs vs. Classes][structs]、[Access Control][access]
-   **CPP-023｜【必须】【建议】**：优先组合；需要继承时使用 `public`，限制实现
    继承并避免切片。覆写虚函数/析构函数显式写 `override` 或 `final`
    中的一个，不再同时写 `virtual`；多重实现继承强烈不推荐，但不是所有
    多重继承都禁止。[来源：Inheritance][inheritance]
-   **CPP-024｜【必须】【建议】**：只为自有类型定义自然、对称且一致的运算符，
    不重载 `&&`、`||`、逗号或一元 `&`。不定义或使用用户定义字面量，
    包括标准库提供的后缀；没有自然顺序的类型为容器提供比较器。
    [来源：Operator Overloading][operators]

## 函数与参数

-   **CPP-025｜【建议】**：优先返回值表达结果；优先按值返回，其次返回引用，
    原始指针返回通常用于可空结果。多个有语义的结果优先用命名结构表达。
    [来源：Inputs and Outputs][inputs]
-   **CPP-026｜【默认】**：必需输入通常按值或 `const T&`；必需输出、
    输入输出参数通常用 `T&`。可选值输入用 `std::optional<T>`，可选
    借用输入用 `const T*`，可选输出用 `T*`。因此，**非 const 引用没有
    被现行规范全面禁止**。[来源：Inputs and Outputs][inputs]
-   **CPP-027｜【建议】**：不要让引用参数必须比本次调用活得更久。需要保留时，
    优先消除生命周期依赖，否则通过指针并在接口说明寿命、可空性及所有权。
    通常先列输入后列输出，相关接口一致性等情况可例外。
    [来源：Inputs and Outputs][inputs]
-   **CPP-028｜【建议】**：函数保持短且单一目的；约 40 行以上触发拆分评估，
    不是硬性行数上限。重载版本语义一致，调用者不必先研究重载决议才能理解
    调用；优先用一份统一说明覆盖整个重载组。
    [来源：Write Short Functions][short-functions]、[Function Overloading][overloading]
-   **CPP-029｜【必须】【建议】**：虚函数禁用默认参数；非虚函数仅在默认表达式
    每次求值相同时考虑使用，不写随时间/状态变化的默认值。通常使用前置
    返回类型，仅在常规语法困难或明显更难读时使用尾置返回类型。
    [来源：Default Arguments][default-arguments]、[Trailing Return Type Syntax][trailing-return]

## 错误处理与类型转换

-   **CPP-030｜【必须】**：采用 Google C++ 异常策略的代码不写异常处理
    及相关机制，如 `throw`、`try` / `catch`、`std::exception_ptr`。
    这是 Google 代码库兼容性决策，不能宣称现代 C++ 普遍禁止异常。
    Windows 依赖兼容例外可能允许编译器开启异常，仍不允许自行编写异常处理。
    [来源：Exceptions][exceptions]、[Windows Code][windows]
-   **CPP-031｜【建议】**：只有语义正确且有实际用途时标注 `noexcept`，例如
    提供可靠的移动保证；不要因为项目关闭异常就机械给全部函数添加它。
    [来源：noexcept][noexcept]
-   **CPP-032｜【建议】【允许/例外】**：通常避免用 RTTI 搭建类型分支树，先考虑虚函数
    等设计。单元测试可以使用 RTTI，程序逻辑已经保证具体类型时可以使用
    `dynamic_cast`；不要手写类型标签假装绕过此规则。
    [来源：Run-Time Type Information][rtti]
-   **CPP-033｜【必须】【建议】**：转换优先使用安全的花括号初始化或适当的
    C++ cast，禁止一般 C 风格 cast（转 `void` 例外）。只在能证明动态
    类型正确时向下转换；严格审查 `reinterpret_cast`、别名及寿命。
    同尺寸位表示转换考虑 `std::bit_cast`。[来源：Casting][casting]

## 类型与表达式

-   **CPP-034｜【建议】**：API 的只读引用/指针及适用成员函数标注 `const`；
    按值参数在函数声明上的顶层 `const` 无益。`const` 操作应能相互并发
    调用，否则明确标注文档；不要把 `const` 当作自动同步机制。
    [来源：Use of const][const]
-   **CPP-035｜【必须】【建议】**：普通整数优先 `int`，有位宽或范围要求时使用
    `int64_t` 等精确宽度类型；正确使用 `size_t` / `ptrdiff_t` 等标准
    别名。不要用无符号仅表达“非负”，注意符号混合与中间计算溢出。
    浮点使用 `float` / `double`，不使用不可移植的 `long double`。
    [来源：Integer Types][integers]、[Floating-Point Types][floating]
-   **CPP-036｜【必须】【建议】**：空指针使用 `nullptr`，空字符使用 `'\0'`；
    获取对象大小优先 `sizeof(variable)`。不需要旧值时使用前置递增/递减。
    常量初始化采用合适的 `constexpr` / `constinit`，不为强迫内联滥用
    `constexpr` / `consteval`。[来源：Other C++ Features][features]
-   **CPP-037｜【必须】【建议】**：优先函数、常量与枚举代替宏；不通过宏拼装 API。
    必要的宏使用项目级前缀、限制作用域，能局部定义和取消就局部处理。
    头文件保护、平台封装等按对应规则处理。[来源：Preprocessor Macros][macros]
-   **CPP-038｜【必须】【建议】**：`auto` 只在改善可读性或安全性时使用；不隐藏
    远处工厂函数的未知返回类型。公开头文件函数几乎不应推导返回类型；
    非 lambda 函数不使用 `auto` 参数，改为明确的模板参数。可用简单形式
    时不使用 `decltype(auto)`。[来源：Type Deduction][auto]
-   **CPP-039｜【必须】**：CTAD 仅用于维护者提供了显式推导指引的模板，标准库
    模板视为已支持；仍要满足类型可读性原则。指定成员初始化器必须符合
    C++20，并按结构体字段声明顺序书写。
    [来源：Class Template Argument Deduction][ctad]、[Designated Initializers][designated]

## 现代语言特性

-   **CPP-040｜【必须】【建议】**：lambda 会离开当前作用域时优先显式捕获，并
    证明被引用对象仍有效；显式捕获本身不能修复悬空引用。`[&]` 只用于寿命
    明显更短的 lambda；`[=]` 只用于短小、捕获集合清楚且不会隐式捕获
    `this` 的情形。初始化捕获用于真实捕获，不借它随意引入新局部概念。
    [来源：Lambda Expressions][lambdas]
-   **CPP-041｜【建议】**：限制复杂模板元编程，将必要复杂性藏在少量基础组件
    内部，说明使用方法并检查错误诊断。不要为了抽象而堆叠递归实例化、
    SFINAE 或难以理解的类型计算。[来源：Template Metaprogramming][templates]
-   **CPP-042｜【必须】【建议】**：有等价概念时优先标准概念与 `requires(...)`，
    避免 `template<Concept T>` 语法和旧式约束技巧。谨慎定义新 concept，
    仅保留在库内部，不把无法由编译器验证的语义宣称为概念保证；不因 C++20
    支持概念就把本无需模板的接口改成模板。[来源：Concepts and Constraints][concepts]
-   **CPP-043｜【必须】**：本次核验版本禁止 C++20 modules；协程只能通过已获
    项目批准的库使用，不自行设计 promise 或 awaitable 类型。这些限制
    必须保留版本日期，并在后续采用新上游规则时重新核验。
    [来源：C++20 modules][modules]、[Coroutines][coroutines]
-   **CPP-044｜【必须】**：Google 当前禁止 `<ratio>`、`<cfenv>` /
    `<fenv.h>`、`<filesystem>` 这些标准库功能。这是所选规范中的限制，
    不能称其为 C++ 标准已弃用。采用其他项目策略时记录差异。
    [来源：Disallowed standard library features][disallowed]
-   **CPP-045｜【必须】【允许/例外】**：非枚举条件的 `switch` 提供 `default`；枚举
    条件可以依靠穷尽检查。实际跨分支贯穿用 `[[fallthrough]];` 标记；
    只有连续标签而无中间代码时无需标注。[来源：Switch Statements][switch]

## 命名注释与排版

-   **CPP-046｜【必须】【允许/例外】**：使用下表命名；与既有 C/C++ 接口或 Rust 互操作
    保持一致时可沿用对应约定。缩写通常视为普通词，如 `Rpc`、`Url`，
    不要把 Go 的 `RPC`、`URL` 规则套到 C++。
    [来源：Naming][naming]

    | 对象 | 约定 | 示例 |
    | --- | --- | --- |
    | 文件 | 全小写；遵循项目的下划线或连字符习惯 | `request_options.h` |
    | 类型、类型别名、concept | PascalCase | `RequestOptions` |
    | 普通函数 | PascalCase | `ParseRequest` |
    | 普通变量、参数、命名空间 | snake_case | `retry_count`、`acme_net` |
    | class 普通数据成员 | snake_case，加尾下划线 | `retry_count_` |
    | struct 普通数据成员 | snake_case，不加尾下划线 | `retry_count` |
    | 合适的常量、枚举值 | `k` 加 PascalCase | `kMaxRetries` |
    | 必须保留的宏 | 项目前缀、全大写、下划线 | `ACME_NET_EXPORT` |

-   **CPP-047｜【允许/例外】**：简单访问器/修改器可按字段形式命名；不是每个 `const`
    局部变量都必须 `k` 前缀。原文对“程序运行期间固定”的常量、静态存储期
    的深度不可变对象和其他存储期给出不同要求，不机械批量重命名。
    [来源：Constant Names][constants]、[Function Names][function-names]
-   **CPP-048｜【必须】【建议】**：非显然的类、结构体和函数说明其用途、输入输出、
    可空性、所有权与寿命、并发约束。接口注释说明如何使用，实现注释说明
    原因与算法细节；覆写只补充新增语义，避免重复显然代码。
    [来源：Comments][comments]
-   **CPP-049｜【必须】**：`TODO` 带可追踪的人员或问题标识；等待未来事件的
    `TODO` 写出明确事件或日期。新文件的许可证说明遵循项目许可模板，
    不杜撰作者、归属或版权信息。[来源：TODO Comments][todo]、[File Comments][file-comments]
-   **CPP-050｜【必须】【允许/例外】**：缩进使用 2 个空格，不使用 Tab；通常最多
    80 列。不可合理拆分的 URL、字符串，以及 include、保护宏和 using
    声明等有原文例外，不为限宽破坏字面量含义。
    [来源：Line Length][line-length]、[Spaces vs. Tabs][indent]
-   **CPP-051｜【必须】【建议】**：左花括号通常接在语句末尾，命名空间内部不额外
    缩进；访问控制标签遵循 Google 格式。不要增加行尾空白；避免无关的大面积
    空白改动。【工程实践】使用项目配置的格式化工具，不把“格式化通过”
    当作语义审查完成。[来源：Formatting][format]

## 原创示例

下面只展示接口约定；它不是完整可链接程序。一个必需输入输出参数可以是
非 `const` 引用，一个可选错误说明可以是指针；失败约定仍需明确。

```cpp
#ifndef ACME_NET_REQUEST_OPTIONS_H_
#define ACME_NET_REQUEST_OPTIONS_H_

#include <string>

namespace acme::net {

struct RequestOptions {
  int timeout_ms = 3000;
  int retry_count = 2;
};

// 校验 options，并将允许的零值替换为默认值。
// 成功时返回 true；失败时保持 options 不变。
// error 可以为空；非空时仅在失败时覆盖其内容。
bool NormalizeOptions(RequestOptions& options, std::string* error);

}  // namespace acme::net

#endif  // ACME_NET_REQUEST_OPTIONS_H_
```

在中文教学示例中使用中文说明；实际项目的注释语言与国际化策略仍按其约定。
在严格 Google 项目中新建文件时，还需加入项目要求的许可证模板。

## 交付前检查

1.  检查目标语言版本、项目策略与本摘要的适用差异。
2.  检查头文件独立编译、直接依赖、宏保护及 include 分组。
3.  检查所有权转移、借用寿命、lambda 捕获和静态/线程局部对象。
4.  检查构造失败、可拷贝/移动语义、接口可空性与错误路径。
5.  检查 Google 特定的异常、RTTI、概念、协程、modules 及库限制。
6.  按项目已有命令执行相关编译、测试和格式检查；明确报告未执行项。

这些检查是 skill 的审查工作流，不宣称 Google 原文指定了某个 CI 命令。

[version]: https://google.github.io/styleguide/cppguide.html#C++_Version
[existing]: https://google.github.io/styleguide/cppguide.html#Existing_Non-conformant_Code
[extensions]: https://google.github.io/styleguide/cppguide.html#Nonstandard_Extensions
[libraries]: https://google.github.io/styleguide/cppguide.html#Third_party_Libraries
[headers]: https://google.github.io/styleguide/cppguide.html#Header_Files
[self-contained]: https://google.github.io/styleguide/cppguide.html#Self_contained_Headers
[guard]: https://google.github.io/styleguide/cppguide.html#The__define_Guard
[iwyu]: https://google.github.io/styleguide/cppguide.html#Include_What_You_Use
[forward]: https://google.github.io/styleguide/cppguide.html#Forward_Declarations
[header-functions]: https://google.github.io/styleguide/cppguide.html#Defining_Functions_in_Header_Files
[include-order]: https://google.github.io/styleguide/cppguide.html#Names_and_Order_of_Includes
[namespaces]: https://google.github.io/styleguide/cppguide.html#Namespaces
[internal]: https://google.github.io/styleguide/cppguide.html#Internal_Linkage
[locals]: https://google.github.io/styleguide/cppguide.html#Local_Variables
[static]: https://google.github.io/styleguide/cppguide.html#Static_and_Global_Variables
[thread-local]: https://google.github.io/styleguide/cppguide.html#thread_local
[ownership]: https://google.github.io/styleguide/cppguide.html#Ownership_and_Smart_Pointers
[constructors]: https://google.github.io/styleguide/cppguide.html#Doing_Work_in_Constructors
[implicit]: https://google.github.io/styleguide/cppguide.html#Implicit_Conversions
[copy]: https://google.github.io/styleguide/cppguide.html#Copyable_Movable_Types
[structs]: https://google.github.io/styleguide/cppguide.html#Structs_vs._Classes
[access]: https://google.github.io/styleguide/cppguide.html#Access_Control
[inheritance]: https://google.github.io/styleguide/cppguide.html#Inheritance
[operators]: https://google.github.io/styleguide/cppguide.html#Operator_Overloading
[inputs]: https://google.github.io/styleguide/cppguide.html#Inputs_and_Outputs
[short-functions]: https://google.github.io/styleguide/cppguide.html#Write_Short_Functions
[overloading]: https://google.github.io/styleguide/cppguide.html#Function_Overloading
[default-arguments]: https://google.github.io/styleguide/cppguide.html#Default_Arguments
[trailing-return]: https://google.github.io/styleguide/cppguide.html#trailing_return
[exceptions]: https://google.github.io/styleguide/cppguide.html#Exceptions
[windows]: https://google.github.io/styleguide/cppguide.html#Windows_Code
[noexcept]: https://google.github.io/styleguide/cppguide.html#noexcept
[rtti]: https://google.github.io/styleguide/cppguide.html#Run-Time_Type_Information__RTTI_
[casting]: https://google.github.io/styleguide/cppguide.html#Casting
[const]: https://google.github.io/styleguide/cppguide.html#Use_of_const
[integers]: https://google.github.io/styleguide/cppguide.html#Integer_Types
[floating]: https://google.github.io/styleguide/cppguide.html#Floating-Point_Types
[features]: https://google.github.io/styleguide/cppguide.html#Other_C++_Features
[macros]: https://google.github.io/styleguide/cppguide.html#Preprocessor_Macros
[auto]: https://google.github.io/styleguide/cppguide.html#Type_deduction
[ctad]: https://google.github.io/styleguide/cppguide.html#CTAD
[designated]: https://google.github.io/styleguide/cppguide.html#Designated_initializers
[lambdas]: https://google.github.io/styleguide/cppguide.html#Lambda_expressions
[templates]: https://google.github.io/styleguide/cppguide.html#Template_metaprogramming
[concepts]: https://google.github.io/styleguide/cppguide.html#Concepts
[modules]: https://google.github.io/styleguide/cppguide.html#modules
[coroutines]: https://google.github.io/styleguide/cppguide.html#coroutines
[disallowed]: https://google.github.io/styleguide/cppguide.html#Disallowed_Stdlib
[switch]: https://google.github.io/styleguide/cppguide.html#Switch_Statements
[naming]: https://google.github.io/styleguide/cppguide.html#Naming
[constants]: https://google.github.io/styleguide/cppguide.html#Constant_Names
[function-names]: https://google.github.io/styleguide/cppguide.html#Function_Names
[comments]: https://google.github.io/styleguide/cppguide.html#Comments
[todo]: https://google.github.io/styleguide/cppguide.html#TODO_Comments
[file-comments]: https://google.github.io/styleguide/cppguide.html#File_Comments
[line-length]: https://google.github.io/styleguide/cppguide.html#Line_Length
[indent]: https://google.github.io/styleguide/cppguide.html#Spaces_vs._Tabs
[format]: https://google.github.io/styleguide/cppguide.html#Formatting
