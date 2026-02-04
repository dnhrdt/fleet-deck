# Fleet Deck - Stream Deck Integration for Fleet Management

**Version**: 1.00
**Timestamp**: 2026-02-04
**Status**: Planning Phase

---

## Project Vision

Transform an Elgato Stream Deck into a **physical Fleet Dashboard** - real-time visual monitoring and instant access to all Claude instances across the Fleet.

**Core Principle**: One button per instance. Visual status at a glance. One press to connect.

---

## The Problem We're Solving

### Current Pain Points

1. **Session Management is Tedious**
   - To start a Claude session: Open terminal → cd to project → type `claude`
   - With multiple parallel sessions: Constant context switching
   - No visibility into which sessions need attention

2. **No Cross-Session Awareness**
   - Running 5 sessions? No way to know if one needs input
   - Must manually check each terminal
   - Easy to forget a session waiting for response

3. **Fleet-Wide Blindness**
   - Captains on production servers (CS01-CS04) - no visibility
   - Alpha Team on Yoda - status unknown without SSH
   - Problems discovered too late

### The Solution: Fleet Deck

```
┌─────────────────────────────────────────────────────────────────┐
│                     STREAM DECK (15 buttons)                    │
├─────────┬─────────┬─────────┬─────────┬─────────┬─────────────┤
│  TRON   │  FLEET  │ RESEARCH│   ARC   │  ALPHA  │             │
│   🟢    │   🟡    │   🟢    │   ⚪    │   🔴    │             │
│  45%    │ INPUT!  │  23%    │  IDLE   │  ERROR  │             │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────────┤
│  CS01   │  CS02   │  CS03   │  CS04   │  YODA   │             │
│   🟢    │   🟢    │   🟡    │   🟢    │   🟢    │             │
│   OK    │   OK    │ REVIEW! │   OK    │   OK    │             │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────────┤
│         │         │         │         │         │             │
│         │         │         │         │         │             │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────────┘
```

**Visual Status:**
- 🟢 Green: Running normally
- 🟡 Yellow: **Needs attention** (waiting for input, review needed)
- 🔴 Red: Error/Stopped/Problem
- ⚪ Gray: Idle/Not running

**Button Press:**
- Local session → Opens Windows Terminal in project directory
- Remote session → Opens SSH session to server (future)

---

## Technical Architecture

### Phase 1: Local Sessions (Han)

```
┌──────────────────────────────────────────────────────────────┐
│                      STREAM DECK                             │
│                    (WebSocket Client)                        │
└──────────────────────────────────────────────────────────────┘
                           ▲
                           │ WebSocket (Port 23654)
                           │ - setImage (dynamic icons)
                           │ - setTitle (context %)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                   FLEET DECK PLUGIN                          │
│                      (Node.js/Python)                        │
│                                                              │
│  - Watches status files                                      │
│  - Updates button icons/text dynamically                     │
│  - Handles button press → opens terminal                     │
└──────────────────────────────────────────────────────────────┘
                           ▲
                           │ File Watch / Polling
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    STATUS FILES                              │
│                                                              │
│  D:\dev\Claude\.fleet-deck-status.json                       │
│  D:\dev\Projects\fleet-plugins\.fleet-deck-status.json       │
│  D:\dev\Projects\claude-research\.fleet-deck-status.json     │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
                           ▲
                           │ Claude Code Hooks write status
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                 CLAUDE CODE SESSIONS                         │
│                                                              │
│  Hook: PostToolUse → Update status file                      │
│  Hook: Notification → Mark "needs attention"                 │
│  Hook: SessionEnd → Mark "idle"                              │
└──────────────────────────────────────────────────────────────┘
```

### Status File Format

```json
{
  "instance": "tron",
  "project": "D:\\dev\\Claude",
  "status": "running",
  "context_percent": 45,
  "needs_attention": false,
  "last_activity": "2026-02-04T14:30:00Z",
  "last_tool": "Edit",
  "error": null
}
```

**Status Values:**
- `running` - Active, processing
- `waiting` - Waiting for user input
- `idle` - No recent activity
- `error` - Something went wrong
- `stopped` - Session ended

### Claude Code Hooks Required

**1. Status Update Hook (PostToolUse)**
```javascript
// After every tool use, update status
{
  status: "running",
  context_percent: getContextPercent(),
  last_activity: new Date().toISOString(),
  last_tool: toolName
}
```

**2. Attention Hook (Notification / UserPromptSubmit)**
```javascript
// When Claude asks a question or needs input
{
  needs_attention: true,
  attention_reason: "Question pending"
}
```

**3. Session Lifecycle Hooks**
```javascript
// SessionStart → status: "running"
// SessionEnd → status: "stopped"
// Compact → update context_percent
```

### Phase 2: Remote Fleet (Future)

```
┌─────────────────────────────────────────────────────────────┐
│                    FLEET DECK PLUGIN                        │
└─────────────────────────────────────────────────────────────┘
                    ▲              ▲
          Local     │              │    Remote
          Files     │              │    API/SSH
                    ▼              ▼
┌─────────────────────┐    ┌─────────────────────────────────┐
│   Han Sessions      │    │      Remote Fleet               │
│   - Tron            │    │   - Yoda (Alpha Team)           │
│   - Arc             │    │   - CS01-CS04 (Captains)        │
│   - Local projects  │    │   - Chimera (Thrawn Legacy)     │
└─────────────────────┘    └─────────────────────────────────┘
```

**Remote Status Collection Options:**
1. **SSH Polling** - Periodically SSH and read status files
2. **Central Status Server** - Fleet instances POST status to central endpoint
3. **Matrix/Webhook** - Push notifications from remote instances

---

## Implementation Plan

### Phase 1: Proof of Concept (This Week)

**Goal**: One button, one local session, visual status

1. **Setup Stream Deck Plugin Development**
   - Install Stream Deck CLI: `npm install -g @elgato/cli`
   - Scaffold plugin: `streamdeck create`
   - Basic button that opens terminal

2. **Status File Generation**
   - Create global hook that writes status file
   - Test with Tron session

3. **Dynamic Button Update**
   - Read status file
   - Update icon color based on status
   - Update title with context %

### Phase 2: Full Local Support

**Goal**: All Han sessions visible and accessible

1. **Multi-Instance Support**
   - Configuration file listing all projects
   - Dynamic button assignment
   - Auto-discovery of sessions

2. **Attention System**
   - Hook into Claude's question/notification system
   - Flash/pulse animation for attention needed
   - Sound notification option

3. **One-Click Session Start**
   - Button opens Windows Terminal
   - Correct directory pre-selected
   - `claude` auto-started (optional)

### Phase 3: Remote Fleet Integration

**Goal**: All Fleet instances visible

1. **Remote Status Protocol**
   - Define status push/pull mechanism
   - Secure authentication
   - Fallback for offline instances

2. **SSH Session Launch**
   - Button → SSH to server
   - Attach to running session (tmux/screen)

3. **Fleet-Wide Dashboard**
   - 15+ button Stream Deck layout
   - Grouping by server/role
   - Alert aggregation

---

## Technical Requirements

### Stream Deck

**Hardware**: Elgato Stream Deck (any model)
- Stream Deck Mini (6 buttons) - Minimum
- Stream Deck MK.2 (15 buttons) - Recommended for local
- Stream Deck XL (32 buttons) - Full Fleet

**Software**:
- Stream Deck Software 6.x
- Node.js 18+ (for plugin development)
- Python 3.10+ (alternative SDK)

### Development Tools

- [Stream Deck SDK](https://docs.elgato.com/sdk/plugins/overview)
- [Stream Deck CLI](https://github.com/elgatosf/cli)
- [Python SDK](https://github.com/strohganoff/python-streamdeck-plugin-sdk) (alternative)

### Fleet Infrastructure

**Local (Han)**:
- Windows 11 + Git Bash
- Windows Terminal
- Claude Code

**Remote (Future)**:
- SSH access to Fleet servers
- Status file convention on all instances

---

## Project Structure

```
fleet-deck/
├── CLAUDE.md              # This file
├── README.md              # User documentation
├── memory-bank/
│   ├── activeContext.md   # Current development status
│   ├── techContext.md     # Technical setup details
│   └── systemPatterns.md  # Development patterns
├── plugin/                # Stream Deck plugin source
│   ├── manifest.json      # Plugin definition
│   ├── src/
│   │   ├── plugin.ts      # Main plugin code
│   │   ├── actions/
│   │   │   └── session.ts # Session button action
│   │   └── utils/
│   │       ├── status.ts  # Status file handling
│   │       └── terminal.ts# Terminal launching
│   └── assets/
│       └── icons/         # Button icons (green, yellow, red, gray)
├── hooks/                 # Claude Code hooks
│   └── fleet-deck-status/ # Status update hook
└── config/
    └── sessions.json      # Session configuration
```

---

## Configuration

### sessions.json

```json
{
  "sessions": [
    {
      "id": "tron",
      "name": "Tron",
      "type": "local",
      "path": "D:\\dev\\Claude",
      "position": 0
    },
    {
      "id": "fleet-plugins",
      "name": "Fleet",
      "type": "local",
      "path": "D:\\dev\\Projects\\fleet-plugins",
      "position": 1
    },
    {
      "id": "claude-research",
      "name": "Research",
      "type": "local",
      "path": "D:\\dev\\Projects\\claude-research",
      "position": 2
    },
    {
      "id": "arc",
      "name": "Arc",
      "type": "local",
      "path": "D:\\dev\\Arc",
      "position": 3
    },
    {
      "id": "alpha",
      "name": "Alpha",
      "type": "remote",
      "host": "yoda",
      "path": "/home/alpha/dev",
      "position": 4
    }
  ]
}
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Single button shows real-time status of Tron session
- [ ] Button color changes based on status
- [ ] Button click opens terminal in correct directory
- [ ] Context percentage shown on button

### Phase 2 Complete When:
- [ ] All configured local sessions have buttons
- [ ] "Needs attention" state clearly visible
- [ ] One-click session management works reliably

### Phase 3 Complete When:
- [ ] Remote Fleet instances visible
- [ ] Can connect to remote session via button
- [ ] Fleet-wide status at a glance

---

## Open Questions

1. **Status Update Frequency**: How often should we poll/update?
   - Too fast = resource waste
   - Too slow = stale information
   - Recommendation: 2-5 seconds for local, 30 seconds for remote

2. **Context Percentage Source**: Where does Claude Code expose this?
   - Currently only in statusline script
   - May need to parse from there or find API

3. **Remote Communication**: Best method for Fleet-wide status?
   - SSH polling (simple but slow)
   - WebSocket server (real-time but complex)
   - File sync via SyncThing (already planned for Yoda)

4. **Button Layout**: How to organize many instances?
   - By server? By role? By project type?
   - Pages vs single view?

---

## References

- [Stream Deck SDK Documentation](https://docs.elgato.com/sdk/plugins/overview)
- [Stream Deck CLI](https://github.com/elgatosf/cli)
- [Python Stream Deck SDK](https://github.com/strohganoff/python-streamdeck-plugin-sdk)
- [DevOps Stream Deck (similar concept)](https://github.com/SantiMA10/devops-streamdeck)

---

## Development Notes

**Developer**: Tron (with Michael)
**Start Date**: 2026-02-04
**Repository**: TBD (likely `dnhrdt/fleet-deck` when ready)

---

_"Physical control for digital Fleet operations."_
