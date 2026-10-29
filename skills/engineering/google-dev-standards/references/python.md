# Python 开发规范

依据 [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)，
核验日期：2026-10-28。以下是面向编写、重构和审查的中文摘要；
“必须”“禁止”按原文强度使用，“建议”允许结合上下文判断。
先遵守项目已经声明的 Python 版本、公共接口和工具配置；
需要偏离本摘要时说明项目依据，不顺手升级依赖或整库改风格。

## 目录

-   [检查与导入](#检查与导入)
-   [异常与状态](#异常与状态)
-   [表达式与函数组织](#表达式与函数组织)
-   [对象模型与并发](#对象模型与并发)
-   [类型与版本](#类型与版本)
-   [排版与字符串](#排版与字符串)
-   [命名与程序入口](#命名与程序入口)
-   [文档与注释](#文档与注释)
-   [资源与维护](#资源与维护)
-   [原创示例](#原创示例)
-   [审查清单](#审查清单)

## 检查与导入

来源：[§2.1 Lint](https://google.github.io/styleguide/pyguide.html#s2.1-lint)、
[§2.2 Imports](https://google.github.io/styleguide/pyguide.html#s2.2-imports)、
[§2.3 Packages](https://google.github.io/styleguide/pyguide.html#s2.3-packages)，
以及 [§3.13 Imports formatting](https://google.github.io/styleguide/pyguide.html#s3.13-imports-formatting)、
[§3.19 Type Annotations](https://google.github.io/styleguide/pyguide.html#s3.19-type-annotations)。

-   **PY-001【必须】**：对代码运行 `pylint`；优先使用项目已维护的配置。
    对误报使用具体符号名、尽量局部的 `pylint: disable=...`；原因不明显时说明。
    不靠整文件屏蔽掩盖无关问题。
-   **PY-002【必须】**：常规导入以包或模块为单位，通过 `module.Symbol` 引用成员；
    不直接导入普通函数、类或常量。
-   **PY-003【允许/例外】**：用于静态分析与类型检查的 `typing`、`collections.abc`、
    `typing_extensions` 符号可直接导入。
    `typing` 与 `collections.abc` 的这些符号应直接导入，且允许一行导入多个。
    不把“模块导入”规则错误套在 `Mapping`、`Sequence`、`Any` 等名字上。
-   **PY-004【必须；允许/例外】**：使用完整包路径，避免隐式或显式相对导入。
    模块名冲突、过长或过于泛化时允许合理别名；
    `import y as z` 形式用于公认缩写，例如 `numpy as np`。
-   **PY-005【必须；建议】**：在模块文档之后、全局声明之前放置导入。
    按 future、标准库、第三方、仓库子包排列，组内按完整模块路径忽略大小写排序。
    普通导入一行一个；组间空行可选。
    同应用子包无需沿用旧版的第五分组。

## 异常与状态

来源：[§2.4 Exceptions](https://google.github.io/styleguide/pyguide.html#s2.4-exceptions)、
[§2.5 Mutable Global State](https://google.github.io/styleguide/pyguide.html#s2.5-global-state)，
以及 [§2.12 Default Argument Values](https://google.github.io/styleguide/pyguide.html#s2.12-default-argument-values)。

-   **PY-006【必须；建议】**：用准确的内置异常表示适当的失败情况。
    自定义异常继承现有异常类型，名称以 `Error` 结尾，避免包名和类型名重复。
-   **PY-007【必须；允许/例外】**：不使用 `assert` 承担参数校验或不可缺少的业务逻辑；
    去掉断言不应改变程序的正确性。`pytest` 测试中的断言是明确允许的用法。
-   **PY-008【必须；允许/例外】**：避免裸 `except:` 或泛捕获 `Exception`。
    例外限于重新抛出，或明确的隔离边界，在边界记录并抑制异常。
    不将这个例外解释为允许静默吞掉任意异常。
-   **PY-009【建议】**：缩小 `try` 的范围，只覆盖预期可能失败的操作。
    需要无条件清理时使用 `finally` 或适当的上下文管理器。
-   **PY-010【建议；允许/例外】**：避免可变全局状态。
    确有必要时使用内部名称，封装外部访问并记录设计理由。
    模块级不可变常量允许且推荐，采用全大写加下划线。
-   **PY-011【必须】**：不以列表、字典等可变对象作为默认参数。
    用 `None` 加显式分支，或满足契约的不可变值。
    需要调用时求值的数据也不要在函数定义阶段求值，例如当前时间或尚未解析的配置。

## 表达式与函数组织

来源：[§2.7 Comprehensions](https://google.github.io/styleguide/pyguide.html#s2.7-comprehensions)、
[§2.8 Default Iterators and Operators](https://google.github.io/styleguide/pyguide.html#s2.8-default-iterators-and-operators)、
[§2.9 Generators](https://google.github.io/styleguide/pyguide.html#s2.9-generators)、
[§2.10 Lambda Functions](https://google.github.io/styleguide/pyguide.html#s2.10-lambda-functions)、
[§2.11 Conditional Expressions](https://google.github.io/styleguide/pyguide.html#s2.11-conditional-expressions)、
[§2.6 Nested](https://google.github.io/styleguide/pyguide.html#s2.6-nested)、
[§2.14 True/False](https://google.github.io/styleguide/pyguide.html#s2.14-truefalse-evaluations)。

-   **PY-012【允许/例外；必须】**：简单推导式和生成器表达式可以使用。
    不使用多个 `for` 子句或多个筛选子句；复杂逻辑改为普通循环。
-   **PY-013【建议】**：直接迭代容器、文件并使用 `in` 等默认运算符；
    同时需要键值时用 `.items()`。不要在迭代时修改同一容器。
-   **PY-014【允许/例外；必须】**：按需要使用生成器。
    如果生成器持有昂贵资源，确保提前停止消费时也有明确的释放路径。
    生成器的 `Yields:` 应描述每次产出的值。
-   **PY-015【建议】**：将 `lambda` 限于简短表达式；
    多行或难读时使用具名函数。优先生成器表达式，而非 `map`／`filter` 加 `lambda`。
    已有 `operator` 函数能够清楚表达时可直接采用。
-   **PY-016【允许/例外】**：三元表达式仅用于简单情况；
    真值部分、条件部分、假值部分各自应能放在一行，复杂时改用完整 `if`。
-   **PY-017【建议】**：仅在需要捕获 `self`、`cls` 之外的局部值等合理情形下嵌套函数或类。
    不为隐藏函数而嵌套；模块级 `_helper` 更便于直接测试。
-   **PY-018【必须；建议】**：用 `is None`／`is not None` 区分未提供值。
    对普通序列优先 `if items:`，对布尔值优先 `if not enabled:`。
    不把 `None`、零值和合法空容器混为一谈；NumPy 数组判空使用 `.size`。

## 对象模型与并发

来源：[§2.13 Properties](https://google.github.io/styleguide/pyguide.html#s2.13-properties)、
[§2.17 Decorators decision](https://google.github.io/styleguide/pyguide.html#decorators-decision)、
[§2.18 Threading](https://google.github.io/styleguide/pyguide.html#s2.18-threading)、
[§2.19 Power Features decision](https://google.github.io/styleguide/pyguide.html#power-features-decision)、
[§3.15 Getters and Setters](https://google.github.io/styleguide/pyguide.html#s3.15-accessors)。

-   **PY-019【允许/例外】**：`@property` 仅表达廉价、直观且符合属性访问预期的逻辑。
    单纯读写字段时直接公开属性；有显著成本或副作用时使用明确的方法。
    不用 property 实现预期由子类覆盖扩展的计算。
-   **PY-020【建议；必须】**：装饰器要有明确收益，文档说明其身份与语义，并编写单元测试。
    避免依赖导入时未必可用的文件、网络或数据库；
    被装饰对象的文档描述调用者实际观察到的装饰后行为。
-   **PY-021【必须】**：不使用 `staticmethod`，除非现有库的接口迫使如此。
    优先模块级函数。`classmethod` 限于具名构造函数，
    或必须修改类相关全局状态的操作等原文列明情形。
-   **PY-022【必须；建议】**：不依赖字典操作或变量赋值的隐含原子性。
    线程通信优先使用 `queue.Queue`；否则采用 `threading` 同步原语。
    在合适场景优先条件变量，不自行假定 GIL 使业务逻辑线程安全。
-   **PY-023【建议；允许/例外】**：避免不必要的自定义元类、导入技巧、运行时编译、
    动态继承或通过 `__del__` 实现清理等复杂特性。
    正常使用内部采用这些机制的标准库工具，例如 `dataclasses`、`enum`、`abc`，不受禁止。

## 类型与版本

来源：[§2.20 Modern Python](https://google.github.io/styleguide/pyguide.html#s2.20-modern-python)、
[§2.21 Type checking decision](https://google.github.io/styleguide/pyguide.html#typed-code-decision)、
[§3.19 Type Annotations](https://google.github.io/styleguide/pyguide.html#s3.19-type-annotations)。

-   **PY-024【工程实践】**：先确认最低 Python 版本及检查器支持，再选择注解语法。
    `X | None` 是原文针对 Python 3.10+ 新代码推荐的形式；
    不因官方示例使用新语法而擅自提高项目最低版本。
    有兼容需要时保留相应 future import；移除前核实运行环境。
-   **PY-025【必须；允许/例外】**：新增或修改公共 API 时提供类型注解，并启用构建期类型检查。
    若项目受误判或其他实际限制阻碍，记录具体问题和 TODO／问题链接。
    原文列举检查器不等于要求替换项目已采用的检查器。
-   **PY-026【建议】**：不要求把模块全部函数一次性加注解。
    优先公共 API、复杂或曾发生类型错误的代码；通常不必注解 `self`、`cls`。
    `__init__` 的返回 `None` 注解也不是全面强制。
-   **PY-027【必须】**：类型允许 `None` 时明确声明联合类型；
    不写 `name: str = None` 依赖检查器推断。文本与二进制数据分别使用 `str`、`bytes`。
-   **PY-028【建议】**：签名优先使用满足契约的抽象容器类型，例如 `Sequence`、`Mapping`。
    需要具体容器时优先内建类型泛型；补全泛型参数，不无意退化为 `Any`。
    输入输出类型有关联时考虑 `TypeVar`，而非抹掉关联。
-   **PY-029【建议】**：复杂类型可定义 `CapWords` 别名，模块内部别名加 `_`。
    本版原文采用 `TypeAlias` 标注；不能用别名绕过普通成员导入限制。
    类型变量名称应描述含义；只有非公开且不受约束的变量可使用 `_T`、`_P` 等短名。
-   **PY-030【建议；允许/例外】**：前向引用按运行版本使用字符串或 future annotations。
    `TYPE_CHECKING` 导入仅用于必须避免运行时依赖的例外，且其中实体只能用于类型检查。
    类型造成的循环依赖优先重构；不要靠条件导入掩盖运行时实际需要的名字。
-   **PY-031【允许/例外；建议】**：必要时可局部忽略类型错误；记录清楚原因并优先精确错误码。
    新增变量注解使用注解赋值，不再新增旧式 `# type: SomeType` 行尾注解。

## 排版与字符串

来源：[§3.2 Line length](https://google.github.io/styleguide/pyguide.html#s3.2-line-length)、
[§3.5 Blank Lines](https://google.github.io/styleguide/pyguide.html#s3.5-blank-lines)、
[§3.6 Whitespace](https://google.github.io/styleguide/pyguide.html#s3.6-whitespace)、
[§3.10.1 Logging](https://google.github.io/styleguide/pyguide.html#s3.10.1-logging)，
以及原文 §3.1、§3.3–3.4、§3.10、§3.10.2、§3.14。

-   **PY-032【必须；允许/例外】**：代码块使用 4 空格，不使用 Tab。
    默认行长上限 80；长导入、注释中的 URL／路径／长参数、
    不便拆分的无空格模块字符串常量、pylint 屏蔽注释有明确例外。
    Black／Pyink 也无法拆至 80 的其他行允许超限；docstring 摘要仍须不超过 80。
    不把 Black 的默认行宽当作本规范行宽。
-   **PY-033【必须；建议】**：使用括号、方括号和花括号的隐式续行，
    不使用反斜杠显式续行。续行对齐或悬挂缩进 4 空格；
    不为普通条件或 `return` 添加无意义括号。
-   **PY-034【必须】**：去掉行尾空白，不在括号内侧加空格，不手工纵向对齐赋值或注释。
    关键字实参与无注解默认值的 `=` 两侧不加空格；
    有类型注解的默认值使用 `name: Type = value`。
-   **PY-035【必须；建议】**：顶层函数和类之间空两行，方法之间空一行；
    类文档与第一个方法之间空一行，`def` 之后不立即空一行。
    多行容器的关闭括号另起一行时推荐尾逗号，单元素元组必须保留逗号。
-   **PY-036【必须；允许/例外】**：不用分号结尾或连接语句。
    通常一行一条语句；原文允许能够整行容纳且没有 `else` 的简单单行 `if`。
    不将 `try`／`except` 压成单行。
-   **PY-037【建议】**：字符串格式化可选 f-string、`%` 或 `.format()`，保持清楚一致。
    不在循环中反复 `+=` 拼接大字符串；收集后 `join` 或使用 `io.StringIO`。
    同文件普通字符串引号风格保持一致；docstring 固定三双引号。
-   **PY-038【必须；范围】**：对接收 `%` 模板和后续实参的日志接口，
    第一参数使用字符串字面量，将值作为独立参数传入；不用 f-string 提前格式化。
    此条的适用前提是日志接口支持这种调用约定。
-   **PY-039【建议】**：错误消息准确说明实际失败条件，明确区分插入值，
    保持容易搜索；不知道原因时不要把猜测写成确定事实。

## 命名与程序入口

来源：[§3.16 Naming](https://google.github.io/styleguide/pyguide.html#s3.16-naming)、
[§3.16.3 File Naming](https://google.github.io/styleguide/pyguide.html#s3.16.3-file-naming)、
[§3.17 Main](https://google.github.io/styleguide/pyguide.html#main)，以及原文 §3.7 Shebang Line。

-   **PY-040【必须；建议】**：模块、包、函数、方法、参数、变量使用 `snake_case`；
    类和异常使用 `CapWords`；常量使用 `UPPER_SNAKE_CASE`；内部名称使用单个前导 `_`。
    类名中的通用缩写整体大写，例如 `HTTPClient`。
-   **PY-041【建议；允许/例外】**：名称含义随可见范围扩大而更明确，避免陌生缩写或类型赘词。
    单字母只用于局部惯例、已说明的数学记号等情形。
    数学代码注明记号来源；与外部接口紧耦合时可因兼容采用外部命名。
    避免滥用双下划线名称及 name mangling。
-   **PY-042【必须】**：Python 文件采用 `.py` 扩展名，文件名不含 `-`。
    不要求一个模块只能包含一个类；将相关类与顶层函数放在一起。
-   **PY-043【必须】**：可执行文件把主要逻辑放入 `main()`，
    通过 `if __name__ == '__main__':` 调用，保证导入不会启动程序。
    使用 Abseil 时调用 `app.run(main)`，不因此为所有项目新增 Abseil 依赖。
    仅直接执行的文件需要合适的 Python 3 shebang。

## 文档与注释

来源：[§3.8 Docstrings](https://google.github.io/styleguide/pyguide.html#docstrings)、
[§3.8.2.1 Test modules](https://google.github.io/styleguide/pyguide.html#test-docs)，
以及 [§3.8.3 Functions and Methods](https://google.github.io/styleguide/pyguide.html#s3.8.3-functions-and-methods)、
[§3.12 TODO Comments](https://google.github.io/styleguide/pyguide.html#s3.12-todo-comments)。

-   **PY-044【必须；建议】**：使用三双引号 docstring。
    首行单独概述并使用句末标点，扩展说明之前空一行。
    模块说明内容和用法；许可声明沿用项目许可证，不擅自替换许可证。
-   **PY-045【必须】**：公共 API、非微小函数或逻辑不明显的函数需要 docstring。
    写清调用语义、约束和调用者关心的副作用，使读者无需读实现就能正确使用。
-   **PY-046【必须】**：按需要使用 `Args:`、`Returns:`／`Yields:`、`Raises:`。
    说明参数语义和类型注解不能表达的信息；
    仅返回 `None` 或摘要已充分解释返回值时可省略 `Returns:`。
    `Raises:` 列出接口相关异常，不把违反调用契约后的行为变成接口保证。
-   **PY-047【允许/例外】**：显式标有 `@override` 且未实质改变父类契约的方法可省略重复文档；
    改变契约或新增副作用时补充差异。
    测试模块、`unittest.TestCase` 子类及其 `test_` 方法不强制重复无信息量的文档。
-   **PY-048【建议】**：类文档说明实例代表什么，除 property 外的公开属性放在 `Attributes:`；
    property 的文档采用属性描述方式，不机械写成“返回……”。
-   **PY-049【建议】**：注释解释非显然的设计理由和约束，不复述 Python 语句。
    行尾注释与代码至少隔两个空格，`#` 后至少一个空格。
-   **PY-050【必须；建议】**：新增 TODO 使用 `TODO(上下文链接): 说明`，优先关联问题记录。
    不只留下个人或团队名字；需要日后移除时说明明确日期或触发条件。

## 资源与维护

来源：[§2.9 Generators](https://google.github.io/styleguide/pyguide.html#s2.9-generators)、
[§3.18 Function length](https://google.github.io/styleguide/pyguide.html#s3.18-function-length)，
以及 [§3.11 Files, Sockets, and similar Stateful Resources](https://google.github.io/styleguide/pyguide.html#s3.11-files-sockets-closeables)、
原文 §4 Parting Words。

-   **PY-051【必须；建议】**：及时关闭文件、套接字、连接等有状态资源。
    优先使用 `with`，适合时用 `contextlib.closing()`；
    不依赖垃圾回收或 `__del__` 的执行时机。
    无法使用上下文管理时，文档明确所有者和释放责任。
-   **PY-052【建议】**：函数保持聚焦。超过约 40 行时考虑是否可合理拆分；
    40 行是审视信号，不是禁止提交的机械阈值。
-   **PY-053【建议】**：修改代码前阅读邻近风格，保持局部一致。
    对全局规则未规定的选择尤其如此；
    也不要把一致性作为永远保留旧式写法或已有缺陷的理由。

## 原创示例

下例是完整可导入的模块，适用于 Python 3.10+；示范模块导入、类型导入例外、资源关闭、
Google docstring 和日志惰性格式化；它是本 skill 的原创示例。
具体业务的输入边界及性能要求仍由项目确定。

```python
"""读取有效名称列表。"""

from collections.abc import Sequence
import logging


def load_names(path: str, allowed: Sequence[str] | None = None) -> list[str]:
    """读取文件中的非空名称，可按允许名单筛选。

    Args:
        path: 使用 UTF-8 编码、每行一个名称的文件路径。
        allowed: 允许的名称；None 表示不筛选，空序列表示全部排除。

    Returns:
        按文件顺序排列的有效名称，保留重复项。

    Raises:
        OSError: 文件无法读取。
        UnicodeError: 文件不是有效的 UTF-8 文本。
    """
    allowed_names = None if allowed is None else set(allowed)
    with open(path, encoding='utf-8') as source:
        names = [line.strip() for line in source]
    names = [name for name in names if name]
    if allowed_names is not None:
        names = [name for name in names if name in allowed_names]
    logging.info('已读取名称文件 path=%r count=%d', path, len(names))
    return names
```

## 审查清单

-   核实 Python 版本、既有格式化器／lint／类型检查器和公共 API 范围。
-   检查可变默认参数、宽泛捕获、资源释放、可变全局状态和并发假设。
-   检查模块导入与类型导入例外，避免误报直接导入的 `Sequence` 等符号。
-   检查公共 API 类型与文档、`None` 和空值语义、导入副作用。
-   检查 80 列及其例外、4 空格、命名、日志模板和 TODO 上下文。
-   运行项目既有的相关测试、`pylint` 和类型检查；只报告实际执行结果。
    测试／检查命令选择属于项目实施步骤，不将未运行项表述为通过。
