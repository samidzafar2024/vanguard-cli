---
id: architecture/clean-architecture/layer-dependency-rules
title: Layer Dependency Rules
domain: architecture
confidence: high
source: imported
tags: []
relations: []
created_at: 2026-01-20T06:02:28.571Z
updated_at: 2026-01-20T06:02:28.571Z
topic: clean-architecture
author: samid@vanguard.dev
---

Domain layer must never depend on infrastructure. Application layer coordinates but contains no business logic. Infrastructure implements ports defined in application layer.
