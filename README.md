# User Story Map Builder

A lightweight, browser-based app to create and manage a user story map with three levels:
- Activities
- Steps
- Details (with status)

## Features
- Add, edit, and delete activities, steps, and details
- Assign status to detail cards:
  - To analyze
  - To estimate
  - Ready
  - In progress
  - Done
  - Cancelled
- Drag and drop support:
  - Reorder activities horizontally
  - Reorder steps inside an activity
  - Reorder/move details across steps
- Multi-select status filtering
- Status masking toggle (hide status chips)
- Fold/unfold legend panel
- Export options:
  - CSV
  - Markdown
  - JSON backup
- Import from JSON backup
- Auto-save via browser `localStorage`

## Tech Stack
- HTML
- CSS
- Vanilla JavaScript

No framework, build tool, or backend is required.

## Quick Start
1. Clone the repository.
2. Open `index.html` directly in your browser.

Alternative: run a local static server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Data Persistence
The app stores data in `localStorage` using:
- `user-story-map-v1` (story map content)
- `user-story-map-ui-v1` (UI preferences)

## Project Structure
- `index.html` - UI layout, controls, modal, template markup
- `styles.css` - styling, layout, responsiveness, status chips
- `app.js` - state, rendering, drag/drop, modal logic, exports/imports
- `APP_DOCUMENTATION.md` - detailed technical documentation

## Export / Import Notes
- Exported filenames are date-prefixed (`YYYY-MM-DD-*`).
- Importing a backup replaces the current map after confirmation.
- Backup format includes metadata and `activities` data.

## License
Add your preferred license (for example, MIT) in a `LICENSE` file.
