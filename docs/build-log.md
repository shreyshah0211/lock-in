# Build log

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
