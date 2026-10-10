# claude-personas

A Claude Code mod that makes Claude talk to you as a character: Gandalf, Yoda, Picard and 11 others.

It puts the persona's voice guide into the system prompt on every request, swaps the spinner and turn-footer words, and shows the active persona in the status line. Switching takes effect on the next reply, with no `/clear`.

Persona voice applies to chat replies only. Files, commits, PR descriptions and code comments stay neutral.

## Install

```
/plugin install persona --marketplace TrevorEdris/claude-personas
```

## Use

| Command | Effect |
|---|---|
| `/persona` | Open the picker |
| `/persona <id> [minimal\|noticeable\|excessive]` | Switch persona |
| `/persona off` | Turn the persona off |
| `/persona create <id>` | Start `~/.claude/personas/<id>.md` from the template |
| `/persona doctor` | List loaded personas and skipped files |
| `/persona reload` | Re-read persona files from disk |

## Your own personas

Files in `~/.claude/personas/*.md` load after the bundled ones; a file with the same `id` replaces the bundled persona. See `personas/_template.md` for the format.
