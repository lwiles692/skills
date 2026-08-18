# Technical elements

## Text formatting

- Use bold only for named UI elements, run-in headings, and notice labels. In HTML, use `b` for these labels, not `strong`; reserve `strong` for strong importance. In Markdown, use double asterisks.
- Use italics sparingly for a term being defined, a word discussed as a word, or semantic emphasis.
- Reserve underlining for links.
- Use code font for text entered verbatim and for code-related entities such as filenames, paths, classes, methods, fields, attributes, data types, HTTP status codes, command output, and placeholders.
- Don't use code font for product names, ordinary domain names, IP addresses, or a URL that a reader navigates to in a browser.
- Preserve an identifier's exact spelling and capitalization. Add a descriptive noun when needed for grammar.

## UI instructions

- Focus on the reader's goal when the UI detail isn't necessary: **Refresh the page.**
- When naming a visible UI element, reproduce its label and put it in bold. Use `b` in HTML and double asterisks in Markdown. Don't add quotation marks or bold a product name that isn't acting as a UI label.
- Prefer the UI's capitalization. If labels are inconsistent or all uppercase, use sentence case consistently.
- Use the appropriate action: **click** for mouse actions, **tap** for touchscreen actions, **select** for choices, **clear** for a selected checkbox, **enter** for text, **go to** for pages, and **press** for physical buttons or keyboard keys.
- Refer to controls by label: **Click Save**, not **Click the Save button**.
- Provide the containing product, page, pane, dialog, or toolbar when a control is hard to locate. Don't locate controls with directional language.
- Use **page** for a web or console page, **dialog** for a smaller detached window, and **pane** or **panel** for a distinct region inside a larger window.
- Use a menu path such as **File > New > Document** only for sequential menu selections. In HTML, give each `>` an accessibility label that means *and then*.
- Format keyboard keys semantically with `kbd` in HTML. Use platform-appropriate key names.

## Code and commands

- Introduce every code sample or command with a complete sentence. Use a colon when the sample follows immediately.
- Follow the project's or language's code style. Don't rewrite working code merely to match prose style.
- Keep samples minimal, relevant, and internally consistent. Prefer runnable examples.
- Wrap code near 80 characters when doing so doesn't change behavior and improves readability.
- Mark omitted code with a comment in the language's syntax. Don't use an ellipsis to represent omitted code, and don't make an incomplete sample click-to-copy.
- Don't include a shell prompt in a command that readers copy. Separate commands from output.
- Introduce a command by its purpose, not with **Run the following command**.
- Link the command name to its reference when useful. In task documentation, show only the arguments needed for the recommended path.
- Keep click-to-copy commands executable. Don't put syntax notation such as optional brackets or mutually exclusive pipes in a runnable command.

## Placeholders and output

- Use descriptive uppercase placeholders with underscores in commands and code: `PROJECT_ID`, not `xxx`.
- Explain every placeholder on first use, even when its meaning seems obvious.
- For one placeholder, use **Replace `PROJECT_ID` with ...**.
- For multiple placeholders, introduce a list with **Replace the following:** and explain them in appearance order.
- Distinguish sample output from commands. Include only output that helps the reader recognize success, extract a value, or diagnose a state.
- Introduce nonliteral output with **The output is similar to the following:**, not language that promises an exact match.

## API and reference entries

- Describe what a method does with a present-tense third-person verb: **Creates a resource**, not **Create a resource**.
- Distinguish the reader's actions from the software's behavior.
- State parameter constraints, defaults, units, side effects, error conditions, and permissions precisely. Don't infer undocumented behavior.
- Keep names, signatures, enum values, and literals in code font and exactly as implemented.

## Links

- Link selectively; every link adds a decision and a possible exit from the task.
- Use short, unique, descriptive link text that makes sense out of context. Prefer the destination title or a phrase that describes it.
- Don't use **click here**, **this document**, **this article**, or a bare URL as ordinary link text.
- For a standalone cross-reference, use **For more information, see ...** or **For more information about ..., see ...**.
- Put punctuation and quotation marks outside the linked text.
- Open links in the current tab by default. Explain downloads, email actions, same-page jumps, or forced new tabs in the link text or surrounding sentence.
- Avoid duplicate links to the same destination unless a long page has distinct entry points.

## Images and other media

- Introduce an image or diagram in the surrounding text.
- Give informative images concise alt text. Don't begin with **Image of** or **Photo of**.
- Use empty alt text for a purely decorative image when nearby text already conveys the same information.
- Keep alt text near 155 characters. Put a longer explanation in visible prose.
- Don't use a caption as a substitute for alt text. Provide text equivalents for information embedded in an image.
- Use sentence case for image labels and captions. Use high-resolution or vector images when practical.

## Dates, times, and numbers

- Spell out dates as **January 19, 2026**. Use ISO 8601 (`2026-01-19`) when a numeric-only date is required.
- Use four-digit years and avoid ambiguous numeric date formats.
- Use a 12-hour time with uppercase **AM** or **PM** and a space: **3 PM**, **3:45 PM**. Match a documented UI or protocol when it uses 24-hour time.
- Avoid time zones unless necessary. When needed, spell out the region and include a UTC offset.
- Use numerals for measurements and values that readers compare. Preserve product- or domain-specific numeric formats.
