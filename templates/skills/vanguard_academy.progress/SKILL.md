---
description: "View your Academy learning progress"
---

# Academy: Progress Dashboard

## Instructions

Call `academy_learner_dashboard` to fetch your enrolled tracks and progress.

Display the results as a formatted dashboard:

### For each enrolled track:

```
## Track: [Track Name]
Progress: [###-------] 30% (3/10 modules)

| # | Module                    | Lessons    | Quiz   | Status      |
|---|---------------------------|------------|--------|-------------|
| 1 | TypeScript Best Practices | 3/3        | Passed | Complete    |
| 2 | DDD & Architecture        | 2/4        | —      | In Progress |
| 3 | Testing Strategies        | 0/2        | —      | Not Started |
```

### Formatting rules:

- Use a text-based progress bar: `[###-------]` where `#` = complete, `-` = remaining (10 chars wide)
- Show modules completed / total after the progress bar
- Per-module table with: sequence number, module name, lessons completed/total, quiz status, overall status
- Quiz status: "Passed", "Failed (attempt N)", or "—" if not taken
- Module status: "Complete" (all lessons done + quiz passed), "In Progress" (some lessons done), "Not Started"
- Highlight the next action with an arrow: `-> Next: Start "DDD & Architecture" Lesson 3`

### If no tracks are enrolled:

Display a friendly message:
```
You're not enrolled in any learning tracks yet.
Run /vanguard:academy.browse to see available tracks and enroll.
```

### If all tracks are complete:

Display a congratulations message with total stats.

## Arguments

$ARGUMENTS