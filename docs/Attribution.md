# Attribution

<!-- File name is PascalCase to match the sibling docs (Plan.md, Requirements.md, Merging.md). -->

Central attribution record for the Unity domains in this repository (LR1–LR3 in
`docs/Requirements.md`). It lists every third-party repository that was analysed, imported, or
reused, the copyright holder, the license, and which parts of the domain rely on it.

**License posture (locked, Phase 3):**

- Permissive licenses only — `MIT`, `Apache-2.0`, `BSD-3-Clause`, `Unlicense`.
- Copyleft primitives (`GPL-3.0` / `LGPL-3.0` and the wider family) are **gated out** and were
  never copied. See `xdomains/game-dev/unity-3d/primitive-not-imported.md`.
- `Unity-Developer-Tools` is **CC-BY-NC-ND-4.0** — design reference only, **no verbatim copy**.
- Every skipped primitive (copyleft, unclear, unattributed) is recorded in
  `xdomains/game-dev/unity-3d/primitive-not-imported.md` with a reason and a revisit note.

## External repositories analysed

| Repository | Holder | SPDX license | Use in this domain |
|---|---|---|---|
| [unity-skills](https://github.com/PraveshKoirala/unity-skills) | Pravesh Koirala | MIT | **Source of the 12 imported primitives** under `xdomains/game-dev/unity-3d/primitives/`. Its `primitive.yaml` contract shapes the `primitive-composition` and `contract-aware-design` abilities/commands. The extraction gate and skip ledger live in `primitive-not-imported.md`. |
| [claude-unity-game-studio](https://github.com/IdoCohen560/claude-unity-game-studio) | Ido Cohen | MIT | Design reference for the full-studio agent hierarchy and studio knowledge (Phase 4). No source copied. |
| [UnityCLI.AgenticExtensions](https://github.com/TomMoore515/UnityCLI.AgenticExtensions) | Thomas Moore | MIT | Design reference for the coordination board, profiling, and UI Toolkit interaction abilities (Phases 2/4). No source copied. |
| [Unity-Open-MCP](https://github.com/AlexeyPerov/Unity-Open-MCP) | Alexey Perov | MIT | Design reference for the Verify family and offline reads. Deliberately unimplemented tools are recorded in `xdomains/game-dev/unity-3d/unity-open-mcp-missing-tools.md`. No source copied. |
| [AIBridge](https://github.com/liyingsong99/AIBridge) | liyingsong | MIT | Design reference for prefab/scene automation, the change loop, and runtime debugging/UI-validation abilities. No source copied. |
| [unity-coding-skills](https://github.com/nowsprinting/unity-coding-skills) | Koji Hasegawa | Unlicense | Design reference for the test-first (TDD) workflow and test subagents. No source copied. |
| [Unity-Developer-Tools](https://github.com/TMHSDigital/Unity-Developer-Tools) | TM Hospitality Strategies | CC-BY-NC-ND-4.0 | **Design reference only — no verbatim copy.** Script-scaffolding emits fresh OAC templates; no rule, snippet, or template text is reused. |

## Imported primitives (12)

Every primitive below was copied verbatim from the `unity-skills` registry into
`xdomains/game-dev/unity-3d/primitives/<id>/` (a `primitive.yaml` plus its declared code files). The
`source_repo` and license are also recorded per primitive in `primitive.yaml`; the upstream registry
records them in `unity-skills/PROVENANCE.md`. Holders marked *(repo owner)* have no in-file copyright
line, so the upstream repository owner is recorded as the holder.

| Primitive id | Source repo | SPDX | Holder |
|---|---|---|---|
| `arch.movement.2d` | https://github.com/genaray/Arch | Apache-2.0 | Genaray *(repo owner)* |
| `csharp.collections.multidictionary` | https://github.com/Alex-Rachel/TEngine | MIT | Alex-Rachel *(repo owner)* |
| `csharp.gameplay.match3` | https://github.com/LibraStack/Match3-SDK | MIT | LibraStack *(repo owner)* |
| `csharp.io.aseprite_parser` | https://github.com/WeAthFoLD/MetaSprite | MIT | WeAthFoLD *(repo owner)* |
| `csharp.math.dywa_pitch_tracker` | https://github.com/UltraStar-Deluxe/Play | MIT | Antoine Schmitt (dywapitchtrack); UltraStar-Deluxe/Play |
| `csharp.threading.disruptor` | https://github.com/dave-hillier/disruptor-unity3d | Apache-2.0 | Dave Hillier; modifications by SoftwareGuy (Coburn) |
| `csharp.utils.crc32` | https://github.com/YarnSpinnerTool/YarnSpinner | MIT | Yarn Spinner *(repo owner)* |
| `unity.data.csv_parser` | https://github.com/CragonGame/CasinosClient | MIT | Cragon |
| `unity.data.fastlz` | https://github.com/ikpil/DotFastLZ | MIT | Ariya Hidayat; Choi Ikpil |
| `unity.entitas.coreloop` | https://github.com/sschmid/Entitas | MIT | sschmid *(repo owner)* |
| `unity.system.main_thread_dispatcher` | https://github.com/PimDeWitte/UnityMainThreadDispatcher | Apache-2.0 | Pim de Witte |
| `unity.system.object_pool` | https://github.com/yimengfan/BDFramework.Core | Apache-2.0 | yimengfan *(repo owner)* |

The set above is exactly the directories present on disk. `tests/attribution.test.ts` enforces
parity between this table and `xdomains/game-dev/unity-3d/primitives/`.

## Copyleft primitives not imported

The import gate (`tools/unity/primitives/src/license-gate.ts`) rejects `GPL-3.0`/`LGPL-3.0` and the
wider copyleft family. These upstream primitives were therefore **not copied** and appear in this
record only to document the decision (full ledger in
`xdomains/game-dev/unity-3d/primitive-not-imported.md`):

| Primitive id | Source repo | SPDX |
|---|---|---|
| `unity.input.mouserotate` | https://github.com/imengyu/Ballance | GPL-3.0 |
| `unity.rendering.npr.starrail` | https://github.com/stalomeow/StarRailNPRShader | GPL-3.0 |
| `unity.rendering.toon.primotoon` | https://github.com/festivities/PrimoToon | GPL-3.0 |
| `unity.simulation.aerodynamics_solver` | https://github.com/ertanturan/Unity-Helicopter-Physics | GPL-3.0 |
| `unity.system.kengine_logger` | https://github.com/mr-kelly/KEngine | LGPL-3.0 |

## Per-file notices

Imported primitive code files retain the copyright/license headers present upstream. Headers were
verified byte-for-byte against the source registry for `DywaPitchTracker.cs` (Antoine Schmitt, MIT),
`CsvParser.cs` (Cragon), `FastLZ.cs` (Ariya Hidayat / Choi Ikpil, MIT),
`UnityMainThreadDispatcher.cs` (Pim de Witte, Apache-2.0), and
`Scripts/DisruptorRingBuffer.cs` (dave-hillier/disruptor-unity3d, Apache-2.0). The remaining ten
imported `.cs` files carried no upstream header, so each was given a one-line
`// Derived from <source_repo> (<license>).` notice naming its upstream repository and SPDX license
(no copyright holder is fabricated). Per-primitive provenance is always recorded in `primitive.yaml`,
and `tests/attribution.test.ts` asserts that every imported code file carries a notice.

Original OAC content (knowledge files, snippets, templates, abilities, commands) is authored for this
repository and carries no third-party notice.

## License texts

### MIT License

Applies to `unity-skills`, `claude-unity-game-studio`, `UnityCLI.AgenticExtensions`, `Unity-Open-MCP`,
`AIBridge`, and the MIT-licensed primitives. Copyright lines per upstream repository:

```
Copyright (c) 2026 Pravesh Koirala (unity-skills)
Copyright (c) 2026 Ido Cohen (claude-unity-game-studio)
Copyright (c) 2026 Thomas Moore (UnityCLI.AgenticExtensions)
Copyright (c) 2024-2026 Alexey Perov (Unity-Open-MCP)
Copyright (c) 2026 liyingsong (AIBridge)
```

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Apache License 2.0

Applies to the `Apache-2.0` primitives listed above. The full license text ships with each upstream
repository and is available at <https://www.apache.org/licenses/LICENSE-2.0>. Files that carried an
Apache header upstream retain it; per-primitive `license: Apache-2.0` is recorded in each
`primitive.yaml`.

### Unlicense

Applies to `unity-coding-skills` (Koji Hasegawa, <https://github.com/nowsprinting/unity-coding-skills>).

```
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>
```

### CC-BY-NC-ND-4.0 (not redistributed)

`Unity-Developer-Tools` (TM Hospitality Strategies) is licensed under Creative Commons
Attribution-NonCommercial-NoDerivatives 4.0 International. It is used as a **design reference only**;
no text, code, rule, snippet, or template was copied, so the material is not redistributed here.

## Update log

- **2026-09-20 — Phase 4 Step 4.2 (ticket 02):** reauthored the Full Studio agent hierarchy
  (`xdomains/game-dev/unity-3d/agent/full-studio/`, 18 agents) from `claude-unity-game-studio` (MIT).
  No source text was copied; only the director→lead→specialist structure, role missions, and
  coordination rules informed the OAC frontmatter and Delegation Maps.
- **2026-09-20 — Phase 3 Step 3.5 (ticket 05):** created this file; recorded the seven analysed
  repositories, the 12 imported primitives, the gated-out copyleft set, and the required license
  texts. Added `tests/attribution.test.ts` for completeness/parity.
