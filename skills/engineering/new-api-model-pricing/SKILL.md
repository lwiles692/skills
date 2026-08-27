---
name: new-api-model-pricing
description: "Fill missing New API model prices from models.dev."
disable-model-invocation: true
---

# New API model pricing

Fill the currently unpriced New API models from the current `https://models.dev/api.json` data, then leave a concise, verifiable account of anything still unresolved.

## Scope

- Work only on models that the New API **未设置价格模型** view identifies as missing a price.
- Use the New API web UI when the user asks to edit the live backend or the authenticated session is needed. Follow the Chrome-control skill when Chrome is the chosen surface.
- Treat `models.dev` as the pricing source. Refresh its public API before a new pricing run; do not reuse stale downloaded data.

## Match prices

1. Extract the complete unpriced-model list from the backend before editing.
2. Look up each model in `models.dev` by exact model ID. Prefer the originating provider's entry when several providers offer it: Anthropic, Google, Z.AI, OpenAI, xAI, or Moonshot AI as applicable.
3. Map `cost.input`, `cost.output`, `cost.cache_read`, and `cost.cache_write` to New API's input, completion, cache-read, and cache-write price fields. Values are USD per 1M tokens. A numeric `0` is a valid price and must not be mistaken for a missing value.
4. Preserve pricing tiers and non-token charges as notes unless the user specifically asks for a pricing mode that supports them. Do not invent image, audio, request, or expression prices from unrelated fields.

## Aliases and gaps

- An exact source match is sufficient to fill a model.
- A family or alias mapping is a pricing decision. Apply it only when the user explicitly names the source model or has already approved the mapping in the current task; record both model IDs in the result.
- If `models.dev` has no matching model or lacks a usable price object, leave it unpriced and report it. Do not substitute another provider's price merely because it is available.

## Save and verify

For each approved model, select its row, enable only the supported price channels that have source values, enter the values, and save. Immediately verify that the model has left the unpriced list. Before submitting the browser saves, obtain the required action-time confirmation for the specific models and price data.

Finish only after every original row is accounted for as saved, intentionally left unresolved, or skipped at the user's direction. Keep the updated backend page available when it is useful to the user.
