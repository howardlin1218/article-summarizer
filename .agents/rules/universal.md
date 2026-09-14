---
trigger: always_on
---

# Project wide rules every agent should follow

- Do not commit any .env files/files containing API keys, secrets, sensitive config information, etc. If unsure, prompt the user for verification with the specific file(s) before resuming action.
- Before completing any task, make sure to test the functionality to ensure the newly implemented feature works as intended. This can be achieved through running existing test cases and/or creating new test cases as needed if the feature is brand new and has no current test case coverage.
- Follow standard coding conventions/best practices, such as leaving necessary comments for non-trivial code/logic, updating relevant documentation for new features/refactors, following existing code styles, descriptive variable names, etc.
- Follow any explicit directives in the prompt, such as "DO NOT...", "MUST...", etc.