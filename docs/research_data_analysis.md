# Research Data Analysis Report


> **Data Support**: For a full list of utterances classified as "Deep" (Category A), see [Deep Utterance List](deep_utterance_list.md).

## 1. Average Character Count per Message
The following table shows the average character count per message for the User and the Agent across four mock sessions (M01-M04).

| Session ID | User ID | User Avg Char Count | Agent Avg Char Count | Message Count (User/Agent) |
| :--- | :--- | :--- | :--- | :--- |
| sess_M_01 | M_01 | **74.50** | 506.92 | 78 / 79 |
| sess_M_02 | M_02 | **185.61** | 522.18 | 38 / 39 |
| sess_M_03 | M_03 | **54.84** | 414.60 | 74 / 75 |
| sess_M_04 | M_04 | **130.61** | 651.19 | 51 / 52 |
| **All** | **Overall** | **97.85** | **511.71** | **Total: 241 / 245** |

> **Note**: Character counts exclude leading/trailing whitespace.

## 2. Knowledge Construction & Debugging Analysis
User utterances in all sessions were analyzed and classified based on Rogers et al.'s simplified categories.

### Classification Criteria
- **A. Deep (Constructive/Reasoning)**: Explanations of reasons, causality (`because`, `therefore`), paraphrasing, detailed logic descriptions, teaching behaviors.
- **B. Shallow (Shallow/Procedural)**: Code snippets without explanation, simple facts, short acknowledgments, procedural logic ("Next", "Yes"), setting study topics.
- **③ Critique/Debugging**: Instances where the user explicitly pointed out and corrected the agent's mistake (logic, code, or conceptual error).

### Summary of Results (M01 - M04)

| User ID | Session | A. Deep (Count/Total) | A. Deep (%) | B. Shallow (Count/Total) | B. Shallow (%) | ③ Critique/Debugging Count |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **M_01** | sess_M_01 | **22 / 78** | **28.2%** | 56 / 78 | 71.8% | **8** |
| **M_02** | sess_M_02 | **32 / 38** | **84.2%** | 6 / 38 | 15.8% | **11** |
| **M_03** | sess_M_03 | **45 / 74** | **60.8%** | 29 / 74 | 39.2% | **9** |
| **M_04** | sess_M_04 | **36 / 51** | **70.6%** | 15 / 51 | 29.4% | **21** |

> **Note**: Percentages are calculated based on the total number of user utterances in each session.

### Conclusion -> Observed Trends
Users M02, M03, and M04 demonstrated significantly higher levels of "Deep" constructive utterances compared to M01. M02 achieved the highest "Deep" ratio (84.2%), consistently explaining concepts in detail. M04 combined high debugging activity (21 counts) with frequent scaffolding questions; while this led to a slightly lower "Deep" ratio (70.6%) compared to M02 due to increased procedural instruction (setting tasks), the interaction density and reasoning level remained very high.

## 3. Methodology & Qualitative Evidence

### Classification Methodology
Utterances were manually classified based on a simplified coding scheme adapted from Rogers et al., focusing on the *depth of cognitive engagement* displayed by the user (Tutor).

#### A. Deep Utterances (Constructive/Reasoning)
Utterances that create new knowledge connections or explain the underlying logic.
*   **Indicators**:
    *   **Causal Explanation**: "It becomes an error *because* it is a string."
    *   **Logic Paraphrasing**: "So this loop runs 5 times, starting from 0."
    *   **Mental Modeling**: "Imagine there are three paths, and it chooses one."
    *   **Diagnostic Feedback**: Pointing out *why* the agent's code failed, not just *that* it failed.

#### B. Shallow Utterances (Procedural/Factual)
Utterances that manage the flow or provide information without reasoning.
*   **Indicators**:
    *   **Direct Instruction/Answers**: "Write `x = 5`." (Giving the answer without explaining why).
    *   **Procedural Management**: "Let's move to the next topic.", "Yes.", "No.", "Correct."
    *   **Simple Facts**: "Python functions use `def`." (Stating a rule without elaboration).

---

### Qualitative Analysis & Evidence

#### Case 1: High Procedure, Low Reasoning (User M01)
User M01 tended to focus on **curriculum progression** and **correctness verification**.
*   **Typical Utterance**: "That is correct. Let's move to functions."
*   **Behavior**:
    *   When the agent made a mistake, M01 often gave the correct code immediately or a brief syntax rule ("You need a colon") without explaining the control flow logic.
    *   High frequency of short confirmations ("Yes", "Good job").
    *   *Result*: Lower average character count (74.50) and lower "Deep" ratio (~28%).

#### Case 2: High Reasoning & Scaffolding (User M04)
User M04 engaged actively in **diagnosis** and **conceptual scaffolding**.
*   **Typical Utterance**: "The `input()` function returns a string, so comparing it to the number 20 causes an error. You need to convert it using `int()`."
*   **Behavior**:
    *   **Scaffolding**: Instead of giving answers, M04 asked leading questions ("What happens if x is 20?").
    *   **Detailed Debugging**: M04 explicitly corrected the agent's misconceptions about `range` boundaries and variable scope with detailed examples.
    *   *Result*: High average character count (130.61) and very high "Deep" ratio (~80%).

### Correlation with "Intentional Mistakes"
The sessions (M02-M04) where the agent (ManaBee) made "intentional mistakes" (e.g., infinite loops, scope errors, type errors) elicited significantly more **Deep** utterances. Users were forced to explain *why* the code was wrong, shifting their mode from "Lecturing" to "Reasoning/Debugging".
