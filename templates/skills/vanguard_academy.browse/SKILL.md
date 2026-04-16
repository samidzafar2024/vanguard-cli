---
description: "Browse available Academy tracks and enroll"
---

# Academy: Browse Tracks

## Instructions

Call `academy_browse_tracks` to fetch all published tracks with your enrollment and progress status.

### Display Each Track

```
## [Track Name]
[Track description]

Modules: N | Estimated: Xh | Status: [Enrolled / Not Enrolled]
Progress: [###-------] 30% (if enrolled)

Modules included:
  1. TypeScript Best Practices (45 min)
  2. DDD & Architecture (60 min)
  3. Testing Strategies (30 min)
  ...
```

### Enrollment

If the learner wants to enroll in a track:
1. Confirm: "Enroll in [Track Name]?"
2. Call `academy_self_enroll` with the track ID
3. Show confirmation: "Enrolled! Run `/vanguard:academy.learn` to start your first lesson."

### If Already Enrolled in All Tracks

```
You're enrolled in all available tracks! Run /vanguard:academy.progress to see your progress.
```

### If No Published Tracks Exist

```
No learning tracks are published yet. Check back later or ask your team lead to publish a track.
```

## Arguments

$ARGUMENTS