# Build log

## v6 (16 Nov 2026)
Two additions asked for by the owner: a globe that opens into a map, and logging by voice.

- **Globe and map.** Home has a card with a small turning globe and a dot wherever friends trained in the last 48 hours. Tapping it grows the globe to the full screen and unrolls it into a flat map (about a second and a half; closing runs it backwards into the card). On the map each tap on a dot goes one level deeper: the region, the city, then the gym with the list of who checked in there; a row opens that person. Drag to pan, pinch or scroll to zoom, three buttons for zoom in, zoom out and the whole world.
- **What the map shows.** Only people you follow, at the gym named on a check-in they posted, for 48 hours. Never a live position. Other campuses appear as sample totals with no people. With your own data on, your own check-in appears at your gym; friends are still the samples and the card says so.
- **How it is drawn.** One canvas painter draws the globe, the flat map and every frame between, so there is no map service and nothing to load. Outlines are Natural Earth (world at 1:110m, Pacific Northwest at 1:50m, Seattle shoreline at 1:10m) and US Census state borders, packed into 44 KB by `tools/geodata.js`. Lake Washington, Lake Union and Mercer Island are sketched by hand. The flat map stops at 78 north and 58 south. With reduced motion on, the globe does not turn and the map opens flat at once.
- **Say it.** A "Say it" button on Home, in the Food tab, on the camera screen and in the check-in form. You describe a workout or a meal; the app works out which it is. A meal opens the usual draft with calories and protein to confirm. A workout fills the check-in form (type, minutes, effort, lifts with weight, reps and sets, and a tag such as exam week); said before the photo, it waits on the camera screen and fills in once the photo is taken, so the 48-hour rule still rests on a photo. If it cannot tell which it was, it asks once.
- **Where the words come from.** In Chrome on a computer, Claude's dictation: a microphone button, words appearing as you talk, and it works the result out when you stop. On a phone inside the Claude app, pages are not given a microphone, so the sheet opens the keyboard and its microphone key does the listening. Opened as a plain file, the browser's own speech recognition is used where there is one. The page receives words only, never sound. The first use asks permission; if refused, the sheet switches to the keyboard and does not ask again.
- **Who works it out.** Claude, when the page may ask it. Otherwise built-in rules: they recognise 14 common lifts, "225 for 5", "3 sets of 8", "3 by 10 at 135", minutes and hours, effort words and tags, and match meals against the small built-in food list.
- The old "Type it" sheet for meals is gone: the Say it sheet takes typing too.

Verified on the final build: the map test (37 checks: unrolling, going deeper, follow-only, 48-hour cut-off, pan, zoom, limits, close, your own data, reduced motion, desktop), the voice test (47 checks with a simulated microphone and simulated Claude: dictation to a meal, dictation to a workout through the camera to a posted check-in, the form's own button, an unclear description, the keyboard route with the built-in rules, a refused microphone, desktop), and every earlier suite.

Not verified: a real microphone, real speech through Claude's dictation, the live model turning real speech into a workout or meal, and anything on a physical iPhone.

## v5 (16 Nov 2026)
Made usable on an iPhone as the owner's own app, without leaving the Claude-hosted page (the only place photo recognition works without a server).

- **Your own data.** The last intro screen offers "Start my own streak": check-ins, meals, lifts, progress photos and badges start empty, the clock runs on real time, and the sample photos and time-skip tools are hidden. The sample stays available from Settings. Friends, squads, the league and rewards remain sample data.
- **Saved to the Claude account.** In that mode the app keeps one private document per signed-in person (plus one per photo) in the page's database. A new or cleared browser picks the data up at start-up with no intro; a second device sees changes within a moment.
- **Combining copies.** Two copies are merged, not swapped: check-ins, meals, lifts and progress photos are joined by id, removed meals leave a marker so they stay removed, and single-value settings come from whichever copy changed last. Only "Erase my data" (two taps) replaces everything. Nothing is stamped as changed until the account has been read, so a stale device cannot overwrite a newer copy, and an empty device never overwrites data.
- **iPhone fixes.** Fields are 16 px on touch screens so Safari does not zoom; tappable non-button elements are marked clickable, which Safari needs before it sends taps; pressed states work; safe-area padding for the notch and home bar; inside Claude the camera button goes straight to the phone's own camera.

Verified on the final build: the phone test (33 checks at iPhone size across three simulated devices sharing one simulated account: start from zero, first photo, save, second device, simultaneous edits, removal, cleared storage, slow connection, erase), plus every earlier suite.

Not verified: anything on a physical iPhone, the real account database (the tests simulate it), and recognition of a real photo by the live model.

Not possible from a web page, and so not built: push notifications, a Home Screen widget, Apple Health, and an App Store or TestFlight install. Those need the native build described in `reports/Lock In next improvements.md`.

## v4 (16 Nov 2026)
The twelve "prototype now" items from `reports/Lock In next improvements.md`. Nothing the owner liked in v3 was removed: the centre camera button, the nutrition bar and the visible workout progress stay where they were, and the new detail sits under them or one tap down.

1. Meal estimates are drafts: named parts with small, medium and large portions, a whole-plate size, one correction line that re-estimates, and a total rounded to the nearest 10 and labelled a rough estimate. The time of day goes to the model with the photo.
2. "Log again" on the Food tab: one tap logs a past meal with the numbers it had. A new estimate for a dish logged before offers the old numbers.
3. Every check-in carries how it was proven (photo, photo and workout, outside photo, workout only). The recognition call also flags a photo of a screen, which prompts a retake and never rejects. The three filing choices are on screen while recognition runs.
4. A check-in path for gyms that ban photos: a photo from outside, or the recorded workout alone. The camera reminds people to keep others and locker rooms out of the shot.
5. Food depth: days logged and daily averages for the week, a protein-only mode, no warning colour on over-target days, fibre and sodium one tap down.
6. Progress: tiles, week bars and grid days open their sessions; a session shows where its points came from; empty charts state what unlocks them; a new best gets a banner after check-in; a body map; a monthly recap shown once on Home.
7. Effort points lead with a verdict against the last four weeks, with the formula in one sentence and four named session bands. Efficiency is renamed intensity and moved into that sheet.
8. A quarter-long squad league ranked on check-ins per member, with weekly standings. Duo streaks can pause without showing a break. A nudge sends an invitation.
9. A "noticed" line on Home, one kind of props in place of three reactions, and plans to train together that only friends see.
10. The intro is four screens ending in the camera; the fourth sets a weekly goal and calorie and protein targets and shows them in the real nutrition bar.
11. A rewards mock-up on Compete: comeback bonus (this one works: 20 extra points on the first check-in after a streak ends), milestone perks, a free-entry quarterly draw and a squad cause. All labelled sample.
12. Connections offer Apple Health and Health Connect; Strava, Garmin, Whoop, Oura, Fitbit and Hevy are shown arriving through them. Posting to Strava is gone. An optional weekly note is written by Claude on request and reads the tags people add to sessions (easy day, sick, exam week, travelling).

Decisions taken along the way:

- A photo flagged as a screen is not labelled in public, because the flag misfires on mirrors and glass. It only prompts a retake and withholds the verified mark.
- An outside photo is taken at its word and skips the gym check, since it would never look like a gym.
- The body map shades each part against the most-trained part, so it shows balance and not volume.
- Fibre and sodium come from the model for real photos and from a small built-in table for sample foods. Meals typed in by hand are left out of those totals and the sheet says so.
- Other squads in the league are sample data. No sponsor, prize or payment exists.

Verified on the final build: every screenshot flow, the photo tests (now 60 checks across no AI, simulated AI and simulated live camera), layout checks from 360 to 1920 px, and random-click runs on phone and desktop sizes.

Not verified: the phone camera opening on a real phone, recognition and re-estimation of a real photo by the live model, and the weekly note from the live model.

## v3 (16 Nov 2026)
Changes made from the owner's feedback on v2. The design note is in `design-v3.md`.

- Camera button back in the middle of the bottom bar, with the clock as a ring around it.
- One camera for everything. One model call classifies a photo as gym, food or neither and returns the details; a three-way switch (Check-in / Meal / Progress) corrects a wrong guess.
- Live viewfinder through `getUserMedia` where the browser allows it, with a fallback to the phone's own camera through a file input.
- Food is a tab again, led by the nutrition bar. Workout progress is shown inline on You. Home shows both at a glance.
- Share button and share cards removed. Icon-only action buttons given text labels.
- Website layout on wide screens: side navigation, centre column, right-hand panel from 1240 px.

Decisions taken along the way:

- Check-ins on the main camera come from the camera only; progress photos may come from the photo library.
- `canvas.toBlob` replaced with `toDataURL` plus a manual Blob. Chrome sometimes held the `toBlob` callback for about a second while waiting for an idle moment.
- If recognition takes more than 12 seconds the app asks what the photo is instead of leaving a spinner up.

Verified on the final build: every screenshot flow on phone, 1440, 1100 and 800 px widths with no console errors; the photo tests (no AI, simulated AI and calendar, simulated live camera); layout checks from 360 to 1920 px; random-click runs on phone and desktop sizes.

Not verified: the phone camera opening on a real phone, and recognition of a real photo by the live model.

## v2 (16 Nov 2026)
Simplification pass based on `reports/Social gym app design research.md`: three tabs, one status number, forgiving streaks (two rest passes, one comeback a month), time-left colours (green, amber, red) in place of streak tiers, milestones in place of most badges, Apple Health and Health Connect as the way workouts come in, Strava as share-out only, Google Calendar deadline through a real connector, duo-streak invite after a check-in, squad goals with end dates.

v3 put back some of what v2 removed (the centre camera button, the Food tab, visible workout detail) because the owner preferred them.

## v1 (15 to 16 Nov 2026)
First working prototype: 48-hour window, streaks and rest passes, Snapchat-style camera, feed, friends, challenges, nutrition dashboard, GitHub-style effort grid, lifts, progress photos, badges, share card.
