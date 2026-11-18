# Lock In

A social gym-streak app, built as a working prototype. Post a gym photo at least every 48 hours and your streak stays alive. Miss the window and it ends. Friends can see your streak and how long you have left.

This is a prototype, not a shipped app. It runs in a browser from one HTML file, and friends and their posts are sample data. You can look around a sample, or start your own streak from zero: your own data is then saved to your Claude account when the page is hosted on Claude, and in the browser otherwise.

## What it does

- **One camera button.** Snap your gym or your food. The app works out which it is and files it as a check-in or a meal. One tap fixes a wrong guess, and you can say what the photo is without waiting.
- **A 48-hour clock.** Every gym check-in puts 48 hours back. Two rest passes and one comeback a month cover the bad weeks.
- **Check-ins that say how they were proven.** A gym photo, a photo plus a recorded workout, a photo from outside, or the recorded workout alone, for gyms that do not allow photos.
- **Friends.** A feed of each friend's latest check-in, one kind of props, a line showing who noticed your check-in, plans to train together, nudges, a weekly leaderboard, and duo streaks that can pause.
- **Squads and a league.** A squad shares one streak. Squads are ranked for the quarter on check-ins per member. The reward ideas on the same screen are a mock-up: nothing is real and nobody pays to enter.
- **One capture button.** The orange button opens a menu: Photo (gym or meal, worked out for you), Barcode, Say it, Progress photo and Weight.
- **Today.** A card at the top of Home: trained today or not, protein and calories left, the week so far, and the one thing to do next.
- **Coach.** A chat with Claude that knows your check-ins, lifts, meals and goals. It gives ideas and never changes anything.
- **One check-in a day.** The streak counts days, so a second gym photo the same day adds to the workout you already posted instead of making a new check-in.
- **Lift photo.** Snap the bar, the dumbbells or a machine stack: Claude reads the exercise and the weight, you confirm the reps, and it goes on today's workout (or becomes today's check-in if you have not posted yet). A normal gym photo with a readable weight fills the lift in too.
- **Next weight.** Every lift shows what to try next time, from your own last set; the check-in form offers it with one tap.
- **Water.** A daily goal (about 35 ml per kg of body weight, more on training days, or your own), one-tap glasses and bottles on the Food tab and in the capture menu, and "two glasses of water" through Say it. Drinks logged as meals, by photo, voice or barcode, count their fluid toward it. Snap any bottle or glass and Claude names it and says how much it holds (a Stanley Quencher, 40 oz); pick how much you drank, and the bottle is saved as a one-tap button.
- **Weight log.** Log your weight and see the trend; goals set from your body follow it.
- **Streak reminders.** In the iPhone app, notifications 12, 3 and 1 hour before your clock runs out.
- **My gym.** Set your gym once (where you stand, or a search). The iPhone app notes when you arrive and leave, even when it is closed, keeps a visit log, shows you and the gym on Apple Maps, puts "At IMA now, 38 min" on Today, and fills the time into your check-in. Location and visits stay on the phone.
- **Apple Maps.** The drawn map stops at city level; a gym opens in Apple Maps with directions.
- **Barcode.** Scan a packaged food (or type the number) to log it with the label's own numbers from Open Food Facts: servings or grams, Nutri-Score, processing level, additives, allergens and ingredients, what is left for today after it, and Claude's read of how it fits your goal with a better swap.
- **Goals from your body.** Age, height, weight, activity and whether you want to lose fat, stay the same or build muscle (with a pace) become daily calories, protein, carbs and fat, with a date for a goal weight. You can still type your own.
- **Food.** A calorie bar with protein, carbs and fat. A photo estimate is a draft you confirm: parts with small, medium and large portions, one line to correct it, and a rounded total labelled a rough estimate. Meals you have logged before can be logged again in one tap. Weekly averages, a protein-only mode, and fibre and sodium one tap down. Private by default.
- **Workout progress.** Check-ins against a weekly goal, effort points compared with your own last four weeks, an 8-week chart, a body map, best lifts, a six-month grid, a monthly recap and private progress photos. Every number opens the sessions behind it.
- **Say it.** Describe a workout or a meal out loud and the app fills in the form: workout type, minutes, effort and lifts, or the meal with its calories and protein. You confirm before it counts, and a workout still needs its gym photo.
- **A globe of where friends trained.** A small turning globe on Home opens to the full screen and unrolls into a flat map. Each tap on a dot goes deeper: region, city, then the gym and who checked in there. It shows friends you follow at the gym of a posted check-in from the last 48 hours, never where anyone is right now.
- **Connections.** Apple Health and Health Connect are simulated. Other fitness apps are shown arriving through those two. Google Calendar is real when the page runs inside Claude.

## Use it on an iPhone

1. Open the Lock In artifact link on the phone while signed in to Claude.
2. On the last intro screen choose **Start my own streak**. Everything starts at zero and is yours.
3. Tap the round camera button. The phone's own camera opens; the photo comes back and is filed as a check-in or a meal.
4. To say it instead, tap **Say it**, tap the box, then the microphone on the iPhone keyboard, and talk. (The Claude app on a phone does not give pages a microphone of their own, so the keyboard's is used. In Chrome on a computer the page has a microphone button and the words appear as you talk.)

Your streak, check-ins, meals, lifts and photos are saved to your Claude account, so they survive a cleared browser and show up on a laptop too. There are no notifications: add the deadline to your calendar from the check-in screen to get a reminder.

## Run it as an iPhone app from Xcode

`ios/LockIn.xcodeproj` is a small iPhone app that shows the built web app (`dist/index.html`) full screen, with the phone's camera and its own icon. It needs a Mac with Xcode; a free Apple Account is enough.

1. Open `ios/LockIn.xcodeproj` in Xcode.
2. Xcode, Settings, Accounts: add your Apple Account.
3. Click **LockIn** at the top of the left sidebar, then **Signing & Capabilities**, and choose your name as the Team. If Xcode says the bundle identifier is taken, change it to anything unique.
4. Plug in the iPhone and tap Trust. On the phone turn on Settings, Privacy & Security, Developer Mode, and restart when asked.
5. Choose the iPhone in the device menu at the top of Xcode and press the Run button.
6. The first time, on the phone: Settings, General, VPN & Device Management, trust your developer certificate, then open Lock In.

With a free account the app stops opening after 7 days; press Run again to renew it, or run `tools/install-iphone.sh`, which rebuilds and installs over Wi-Fi once the phone has been paired by cable (phone unlocked, same Wi-Fi as the Mac). Data is kept on the phone only. Notifications, a widget and Apple Health are not wired up yet.

**Claude in the app.** Photo recognition, calorie estimates and Say it call the Claude API from the app itself (`ios/LockIn/ClaudeBridge.swift`), so they need your own API key:

1. Copy `ios/Config/Secrets.example.xcconfig` to `ios/Config/Secrets.xcconfig` (git ignores it).
2. Put your key from console.anthropic.com after `CLAUDE_API_KEY =`, and optionally your signing team after `DEVELOPMENT_TEAM =`.
3. Build again.

The key is built into your copy of the app, which is fine for your own phone but not for an app you hand to others. Without a key the app still works and asks you what each photo is.

## Try it on a computer

Open `dist/index.html` in a browser. Nothing else is needed.

Two things depend on where the page is hosted:

| | Hosted on Claude (artifact) | Opened as a file or hosted on your own HTTPS site |
|---|---|---|
| Camera | The button opens the phone's own camera and takes the photo back | Live viewfinder inside the page |
| Photo recognition and calorie estimates | Done by Claude | Not available: the app asks what the photo is and uses labelled sample estimates |
| Say it | Chrome on a computer: Claude's dictation, words appear as you talk. Phone: the keyboard's microphone. Claude turns the words into a workout or a meal | The browser's own speech recognition where it has one, else the keyboard's microphone. Plain built-in rules turn the words into a workout or a meal, more roughly |
| Add deadline to Google Calendar | Uses your connector | Falls back to a calendar link |
| Your own data | Saved to your Claude account, across devices | Saved in that browser only |

## Project layout

```
src/shell.html        page skeleton
src/styles.css        all styles
src/js/01..99-*.js    the app, in load order (state, engine, home and social, camera, meals, league, food, profile, progress, connections, sync, globe and map, voice)
src/js/18-geodata.js  map outlines, generated by tools/geodata.js (Natural Earth and US Census, public domain)
dist/index.html       the built single-file app (fonts inlined)
tools/build.py        joins src/ into dist/index.html
tools/geodata.js      rebuilds the map outlines (cd tools && npm install && node geodata.js)
tools/*.py            browser tests (see below)
ios/                  the Xcode project for the iPhone app (a shell around dist/index.html)
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
CHROME=/path/to/chrome python3 tools/voice_test.py   # Say it: simulated dictation and simulated Claude, the keyboard route, and a refused microphone
CHROME=/path/to/chrome python3 tools/map_test.py     # the globe and the map: unrolling, going deeper, who is shown, reduced motion
CHROME=/path/to/chrome python3 tools/sizes.py        # nothing may spill sideways from 360 px phones to 1920 px desktops
CHROME=/path/to/chrome python3 tools/monkey.py 7     # random clicks with seed 7; add a width and height for desktop
```

## What is not built

A native iPhone app, a server, real friends, notifications, real health-data access, sponsors and prizes. The other squads in the league are sample data. The recognition and voice tests simulate Claude's replies and the microphone; recognition of a real photo or of real speech by the live services has not been verified, and neither has the app on a physical iPhone. The map knows only the sample gyms and campuses: a gym it does not know is placed at your campus, and the two Seattle lakes are drawn by hand.
