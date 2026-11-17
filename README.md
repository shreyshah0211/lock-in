# Lock In

A social gym-streak app, built as a working prototype. Post a gym photo at least every 48 hours and your streak stays alive. Miss the window and it ends. Friends can see your streak and how long you have left.

This is a prototype, not a shipped app. It runs in a browser from one HTML file, and friends and their posts are sample data. You can look around a sample, or start your own streak from zero: your own data is then saved to your Claude account when the page is hosted on Claude, and in the browser otherwise.

## What it does

- **One camera button.** Snap your gym or your food. The app works out which it is and files it as a check-in or a meal. One tap fixes a wrong guess, and you can say what the photo is without waiting.
- **A 48-hour clock.** Every gym check-in puts 48 hours back. Two rest passes and one comeback a month cover the bad weeks.
- **Check-ins that say how they were proven.** A gym photo, a photo plus a recorded workout, a photo from outside, or the recorded workout alone, for gyms that do not allow photos.
- **Friends.** A feed of each friend's latest check-in, one kind of props, a line showing who noticed your check-in, plans to train together, nudges, a weekly leaderboard, and duo streaks that can pause.
- **Squads and a league.** A squad shares one streak. Squads are ranked for the quarter on check-ins per member. The reward ideas on the same screen are a mock-up: nothing is real and nobody pays to enter.
- **Food.** A calorie bar with protein, carbs and fat. A photo estimate is a draft you confirm: parts with small, medium and large portions, one line to correct it, and a rounded total labelled a rough estimate. Meals you have logged before can be logged again in one tap. Weekly averages, a protein-only mode, and fibre and sodium one tap down. Private by default.
- **Workout progress.** Check-ins against a weekly goal, effort points compared with your own last four weeks, an 8-week chart, a body map, best lifts, a six-month grid, a monthly recap and private progress photos. Every number opens the sessions behind it.
- **Connections.** Apple Health and Health Connect are simulated. Other fitness apps are shown arriving through those two. Google Calendar is real when the page runs inside Claude.

## Use it on an iPhone

1. Open the Lock In artifact link on the phone while signed in to Claude.
2. On the last intro screen choose **Start my own streak**. Everything starts at zero and is yours.
3. Tap the round camera button. The phone's own camera opens; the photo comes back and is filed as a check-in or a meal.

Your streak, check-ins, meals, lifts and photos are saved to your Claude account, so they survive a cleared browser and show up on a laptop too. There are no notifications: add the deadline to your calendar from the check-in screen to get a reminder.

## Try it on a computer

Open `dist/index.html` in a browser. Nothing else is needed.

Two things depend on where the page is hosted:

| | Hosted on Claude (artifact) | Opened as a file or hosted on your own HTTPS site |
|---|---|---|
| Camera | The button opens the phone's own camera and takes the photo back | Live viewfinder inside the page |
| Photo recognition and calorie estimates | Done by Claude | Not available: the app asks what the photo is and uses labelled sample estimates |
| Add deadline to Google Calendar | Uses your connector | Falls back to a calendar link |
| Your own data | Saved to your Claude account, across devices | Saved in that browser only |

## Project layout

```
src/shell.html        page skeleton
src/styles.css        all styles
src/js/01..99-*.js    the app, in load order (state, engine, home and social, camera, meals, league, food, profile, progress, connections)
dist/index.html       the built single-file app (fonts inlined)
tools/build.py        joins src/ into dist/index.html
tools/*.py            browser tests (see below)
docs/                 design note and build log
reports/              research behind the product decisions
```

The app is plain JavaScript with no framework. Each screen is a function that returns HTML; `render()` redraws the current tab; state lives in one object saved to `localStorage`.

## Build

```
cd tools && npm install        # fetches the two fonts
cd .. && python3 tools/build.py
```

## Tests

The tests drive a real Chrome through Playwright.

```
pip install playwright pillow
CHROME=/path/to/chrome python3 tools/shots.py        # walks every flow on phone and desktop sizes, saves screenshots to shots/
CHROME=/path/to/chrome python3 tools/photo_test.py   # a real photo through the camera: no AI, simulated AI, simulated live camera
CHROME=/path/to/chrome python3 tools/phone_test.py   # your-own-data mode at iPhone size, with a simulated account shared by three devices
CHROME=/path/to/chrome python3 tools/sizes.py        # nothing may spill sideways from 360 px phones to 1920 px desktops
CHROME=/path/to/chrome python3 tools/monkey.py 7     # random clicks with seed 7; add a width and height for desktop
```

## What is not built

A native iPhone app, a server, real friends, notifications, real health-data access, sponsors and prizes. The other squads in the league are sample data. The recognition tests simulate Claude's replies; recognition of a real photo by the live model has not been verified, and neither has the app on a physical iPhone.
