# Global Rules - No File Creation

## Rule: Do NOT Create Files Unless Explicitly Requested

### Context

The user has explicitly stated: "No crear archivos a menos que sea explicitamente solicitado"
(Do NOT create files unless explicitly requested)

### Implementation

#### BEFORE creating ANY file, ask yourself:

1. ❌ Did the user explicitly ask to "create" a file?
2. ❌ Did the user say "write a file" or "new file"?
3. ❌ Did the user ask for documentation in a new file?

If ANY of these are NO → **DO NOT CREATE THE FILE**

#### INSTEAD:

- ✅ Edit existing files using StrReplace
- ✅ Update existing documentation files
- ✅ Add content to existing files
- ✅ Ask user for permission if unsure

### Examples

#### ❌ WRONG - Creating file without explicit request:

```
User: "Document this function"
You create: new-documentation.md
PROBLEM: User didn't ask for a NEW file
```

#### ✅ CORRECT - Ask or update existing:

```
User: "Document this function"
You: "I'll add documentation to the existing orchestrator.md file"
OR: "Should I create a new documentation file for this?"
```

#### ❌ WRONG - Multiple new files:

```
User: "Explain the workflow"
You create: workflow.md, architecture.md, patterns.md
PROBLEM: Not explicitly requested
```

#### ✅ CORRECT - Single file or ask:

```
User: "Explain the workflow"
You: "I'll update the existing orchestrator.md with workflow details"
OR: "Can I create a workflow.md file to document this?"
```

### Exception: Explicit Requests

**ONLY create files if user says:**

- "Create a new file called..."
- "Write a file..."
- "Add a new documentation file..."
- "Make a file for..."
- "Generate a file with..."

### Enforcement

Every time you're about to use Write tool:

1. Stop and ask: "Did the user explicitly request a new file?"
2. If YES → proceed with Write
3. If NO → use StrReplace on existing file or ask user first

### Current Status

✅ **ACTIVE** - This rule is in effect for this session and beyond.

---

## Examples of This Rule in Action

### Session Example 1

- **User asks:** "Update the documentation about the orchestrator"
- **You should:** Edit orchestrator.md using StrReplace
- **Do NOT:** Create new files

### Session Example 2

- **User asks:** "Create a README for the orchestrator"
- **You should:** Create it (explicitly requested with "Create")
- **Then:** Store this rule for future reference

### Session Example 3

- **User asks:** "I need documentation about progress, best practices, and implementation"
- **You should:** Ask "Should I add these to orchestrator.md or create separate files?"
- **Do NOT:** Silently create 3 new files

---

## How This Helps

✅ Keeps the codebase clean and organized
✅ Prevents file bloat and confusion
✅ Respects the user's project structure
✅ Forces intentional file creation
✅ Maintains focus on actual problem-solving

Remember: **Less files, more focused documentation.**
