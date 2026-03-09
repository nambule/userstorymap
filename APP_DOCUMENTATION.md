# User Story Map Builder - App Documentation

## Overview
User Story Map Builder is a client-side web app for organizing product work into:
- Activities (high-level user goals)
- Steps (actions within each activity)
- Details (specific stories/tasks per step with status)

The app is implemented as a static frontend using:
- `index.html`
- `styles.css`
- `app.js`

No backend or build process is required.

## Core Features
- Create, edit, and delete activities, steps, and details
- Assign and edit status on detail cards
- Drag and drop:
  - Activities horizontally
  - Steps horizontally within their activity
  - Details vertically and across steps
- Status filter chips (multi-select + `All`)
- Status masking toggle (hide/show status chips)
- Fold/unfold the left legend panel
- Export story map as:
  - CSV
  - Markdown
  - JSON backup
- Import JSON backup (replaces current map after confirmation)
- Persistent state in browser `localStorage`

## Statuses
Detail cards support these statuses:
- `to_analyze`
- `to_estimate`
- `ready`
- `in_progress`
- `done`
- `cancelled`

Legacy imported values are normalized:
- `todo` -> `to_analyze`
- `blocked` -> `cancelled`

## Data Model
The app state is an array of activities:

```json
[
  {
    "id": "uuid",
    "title": "Activity title",
    "steps": [
      {
        "id": "uuid",
        "title": "Step title",
        "details": [
          {
            "id": "uuid",
            "text": "Detail text",
            "status": "to_analyze"
          }
        ]
      }
    ]
  }
]
```

## Persistence
Two keys are used in `localStorage`:
- `user-story-map-v1`: main story map data
- `user-story-map-ui-v1`: UI preferences

UI preferences include:
- `legendCollapsed`
- `detailFilter`
- `maskDetailStatus`

If no saved data exists, seed/sample data is loaded automatically.

## Exports and Imports
- Exported files are prefixed with the current date (`YYYY-MM-DD-...`)
- CSV columns: `activity, step, detail, status`
- Markdown export generates a hierarchy (`#`, `##`, `###`) with status labels on detail lines
- Backup export format:

```json
{
  "format": "user-story-map-backup-v1",
  "exportedAt": "ISO timestamp",
  "activities": ["..."]
}
```

Import accepts either:
- a direct activities array
- an object containing an `activities` array

## UI Structure
- Header actions:
  - Status filter buttons
  - Settings menu (legend toggle, status mask, export/import)
  - `+ Activity` button
- Main area:
  - Left legend panel (can be collapsed)
  - Story map board (3 rows: activities, steps, details)
- Modal editor:
  - Add/Edit/Delete flows
  - Optional status selector for details

## How to Run
1. Open `index.html` in a browser.
2. Start creating or editing cards.
3. Data is saved automatically in `localStorage`.

Optional local server example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## File Responsibilities
- `index.html`: layout, controls, modal, and templates
- `styles.css`: visual design, responsive behavior, card/status styling
- `app.js`: state management, rendering, modal flows, drag/drop, persistence, export/import

## Notes
- The app uses `crypto.randomUUID()` for IDs.
- The board re-renders after every state change.
- Empty states are shown for missing steps/details.
