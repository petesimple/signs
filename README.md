## How to run locally (dev distro)

### Prereqs
You need Node.js (includes `node` + `npm`).

Verify:
```bash
node -v
npm -v

If you see command not found, install Node:

Option A (Homebrew):

brew install node

Option B (Official installer):
Install the macOS LTS package from nodejs.org, then re-run the version check.

⸻

Setup (first time)

From the folder where you want the project to live:

mkdir -p bar-signage
cd bar-signage

mkdir -p server/uploads public

npm init -y
npm i express socket.io better-sqlite3 multer sharp


⸻

Run

node server/index.js

Open in your browser:
	•	Admin: http://localhost:5177/admin
	•	Screen 1: http://localhost:5177/screen/1
	•	Screen 2: http://localhost:5177/screen/2
	•	Screen 3: http://localhost:5177/screen/3

⸻

Notes
	•	Uploaded images land in server/uploads/
	•	SQLite database file is created at server/signage.sqlite
	•	Keep the server running while screens are open so live updates work

⸻

Troubleshooting (macOS Homebrew PATH)

If brew install node worked but node is still not found:

echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

Then:

node -v
npm -v

