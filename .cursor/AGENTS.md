# Agent Configuration

## Global Directives

### 🚫 File Creation Policy

**Do NOT create new files unless explicitly requested by the user.**

This is a hard rule. Before using the `Write` tool to create any new file, verify that the user has explicitly asked for file creation.

### ✅ Allowed Actions

- Edit existing files with StrReplace
- Modify code in existing files
- Update existing documentation
- Ask for user permission when unsure

### ❌ Prohibited Actions

- Create files without explicit request
- Create multiple files for convenience
- Create documentation files "just to be organized"
- Create supporting files without asking first

### Exception

Only create files if the user explicitly uses words like:

- "create", "write", "make", "generate", "new file"

---

## Project Context

**Project:** react-import-sheet
**Main Focus:** Orchestrator module for ETL workflow

### Key Files (Do NOT create alternatives)

- `src/core/orchestator/orchestrator.md` - Main documentation
- `src/core/orchestator/main.ts` - Implementation
- `src/core/orchestator/PRE_INTEGRATION_CHECKLIST.md` - Pre-integration checks

### Existing Documentation Structure

Keep all documentation in the established files.
Do NOT create parallel documentation.

---

## How to Handle Documentation Requests

1. **If user asks to "document X"**: Edit orchestrator.md with StrReplace
2. **If user asks to "create docs for X"**: Ask for permission or create explicitly
3. **If user asks for "multiple topics"**: Add to existing file, don't create new ones

---

## Remember

Less files = better project organization = faster development
