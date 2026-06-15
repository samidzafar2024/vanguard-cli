---
description: "Take an Academy module quiz"
---

# Academy: Quiz Mode

## Instructions

### Step 1: Find the Quiz

**If a module ID is provided in arguments:**
1. Call `academy_learner_module` to get the module details
2. Use the quiz `exerciseId` from the response

**If no arguments provided:**
1. Call `academy_learner_dashboard` to find enrolled tracks
2. Find the first module where all lessons are complete but the quiz hasn't been passed
3. Call `academy_learner_module` to get the quiz exerciseId
4. If no quizzes are available, suggest completing more lessons first

### Step 2: Load Questions

Call `academy_learner_quiz` with the `exerciseId`. This returns questions WITHOUT answers (safe for the learner to see).

### Step 3: Present the Quiz

Display a brief intro:
```
Quiz: [Module Name] (N questions, 70% to pass)
```

Present each question **one at a time**:

```
Q1/5: What is the primary purpose of an Aggregate in DDD?

  a) To group related database tables
  b) To enforce consistency boundaries
  c) To define API endpoints
  d) To manage user sessions

Your answer:
```

- Wait for the learner's answer before showing the next question
- Accept answers as letter (a/b/c/d) or number (1/2/3/4)
- Track the mapping: convert letter answers to 0-based indices (a=0, b=1, c=2, d=3)
- Do NOT reveal if the answer is correct yet — just acknowledge and move on
- After each answer, show progress: "Got it. Moving to Q2/5..."

### Step 4: Review Before Submission

After all questions are answered, show a summary:

```
Your answers:
  Q1: b) To enforce consistency boundaries
  Q2: a) Application layer
  Q3: c) ...
  Q4: d) ...
  Q5: b) ...

Submit these answers? (You can change any answer by saying "change Q3 to a")
```

Allow the learner to change answers before final submission.

### Step 5: Submit and Show Results

Call `academy_submit_quiz` with:
- `exerciseId`: the quiz ID
- `answers`: a `Record<string, number>` mapping questionId to the 0-based option index

Display the results:

```
Results: 4/5 (80%) — PASSED!

Q1: Correct - Aggregates enforce consistency boundaries. [explanation]
Q2: Correct - The Application layer defines port interfaces. [explanation]
Q3: INCORRECT - You chose "c" but the correct answer was "b". [explanation]
Q4: Correct - ...
Q5: Correct - ...
```

If failed, encourage the learner:
```
You scored 2/5 (40%). You need 70% to pass.
Review the module lessons and try again when ready!
```

## Rules

- NEVER reveal correct answers before submission
- Present one question at a time — don't show all questions at once
- Let the learner review and change answers before final submission
- Show explanations only AFTER submission (they come from the quiz result)
- Convert letter answers (a/b/c/d) to 0-based indices for the API

## Arguments

$ARGUMENTS