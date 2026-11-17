# Lock In v3 — design note (2026-11-16, from Shrey's feedback)
Why: v2 hid too much and used unlabeled icons. He wants the Snapchat-style centre camera button, one camera that
recognises gym vs food, nutrition bar + workout progress out front, real phone camera, no Share, and a real website feel.
Approach (picked: keep single-file app, extend): 
- Nav: bottom bar Home · Compete · (Snap) · Food · You, all labelled. Desktop >=1024: side nav + centre column + right rail (>=1240).
- Camera: one shutter. Live viewfinder via getUserMedia when the browser allows (not on Claude-hosted pages); else shutter
  opens the phone camera via file input. After a photo, one Claude call classifies gym / food / other and returns details;
  routes to check-in or meal; 3-way switch (Check-in / Meal / Progress) to correct. No Claude: ask which it is.
- Food tab returns (calorie bar + macro bars). You shows workout progress inline. Home gets Food-today and This-week tiles.
- Share removed (button, cards, downloads capability). Icon-only buttons get text labels.
Rejected: separate hosted site (needs hosting outside Claude; offer later); phone-frame-only desktop (reads as a mock, not a website).
Build log: build-log.md
