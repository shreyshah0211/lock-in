/* Everything here is sample content for the prototype: the people, their posts,
   the campus numbers. Nothing is fetched from anywhere. */
const TYPES = [
  { k: 'push', n: 'Push', v: 'Push day', c: '#E23B32' },
  { k: 'pull', n: 'Pull', v: 'Pull day', c: '#2D6BE0' },
  { k: 'legs', n: 'Legs', v: 'Leg day', c: '#F2B91C' },
  { k: 'upper', n: 'Upper body', v: 'Upper body', c: '#8C6FD6' },
  { k: 'full', n: 'Full body', v: 'Full body', c: '#141A33' },
  { k: 'cardio', n: 'Cardio', v: 'Cardio', c: '#2E9E5B' },
  { k: 'core', n: 'Core', v: 'Core', c: '#FF8A1E' },
  { k: 'sport', n: 'Sport', v: 'Sport', c: '#2AA7E8' },
  { k: 'mobility', n: 'Stretch', v: 'Stretch and mobility', c: '#7CC4AA' },
  { k: 'other', n: 'Other', v: 'Workout', c: '#9499AD' }
];
const TYPE = Object.fromEntries(TYPES.map(t => [t.k, t]));
const EFFORT = ['', 'Easy', 'Steady', 'Hard', 'All out'];
// id, name, colour, campus, gym, streak days, hours since last check-in, total check-ins, best, reliability, usual sessions, duo streak with you, bio
const FRIEND_SEED = [
  ['maya', 'Maya Okafor', '#E0527A', 'UW', 'IMA', 143, 5.2, 412, 143, .97, ['legs', 'full', 'push'], 38, 'Powerlifting club. Squats before sunrise.'],
  ['leo', 'Leo Park', '#2D6BE0', 'UW', 'IMA', 31, 20.5, 96, 44, .9, ['push', 'pull', 'legs'], 0, 'Climbing, lifting, bad at rest days.'],
  ['sofia', 'Sofia Reyes', '#8C6FD6', 'UW', 'IMA', 64, 0.35, 188, 64, .95, ['cardio', 'core', 'mobility'], 12, 'Half marathon in March.'],
  ['arjun', 'Arjun Mehta', '#17936A', 'UW', 'IMA', 16, 46.3, 61, 29, .7, ['upper', 'push', 'sport'], 9, 'Intramural basketball. Here for the streak.'],
  ['zoe', 'Zoe Chen', '#F2542D', 'UW', 'Northlake Strength', 9, 11.4, 34, 21, .85, ['pull', 'legs', 'upper'], 0, 'New to lifting. Day one was nine days ago.'],
  ['noah', 'Noah Williams', '#2AA7E8', 'UW', 'IMA', 4, 30.1, 22, 15, .6, ['full', 'cardio'], 0, 'Back after midterms wrecked my streak.'],
  ['amara', 'Amara Diallo', '#C2610C', 'WSU', 'Chinook Rec', 88, 14.2, 251, 88, .93, ['sport', 'legs', 'cardio'], 0, 'Club soccer. WSU, sorry.'],
  ['kenji', 'Kenji Sato', '#3B4A8A', 'UW', 'IMA', 212, 26.4, 603, 212, .99, ['full', 'pull', 'push'], 0, 'Two hundred days and counting.'],
  ['priya', 'Priya Nair', '#B03A8C', 'UW', 'IMA', 27, 39.2, 80, 33, .8, ['mobility', 'core', 'cardio'], 5, 'Yoga most days, weights when dragged.'],
  ['lucas', 'Lucas Silva', '#6B7280', 'Oregon', 'Rec Center', 0, 70, 48, 12, .5, ['push', 'upper'], 0, 'Starting over. Again.'],
  ['hana', 'Hana Kim', '#0E8F8F', 'UW', 'IMA', 2, 0.8, 7, 2, .75, ['legs', 'core'], 0, 'Day two. Be nice.'],
  ['omar', 'Omar Haddad', '#7A5AF5', 'UW', 'IMA', 51, 33.3, 160, 51, .9, ['pull', 'upper', 'cardio'], 0, 'Rowing team, off season.']
];
const WEEK_PTS = { maya: 318, kenji: 296, sofia: 281, amara: 240, omar: 232, leo: 201, priya: 164, arjun: 122, zoe: 118, noah: 64, hana: 41, lucas: 0 };
const PEOPLE_SEED = [
  ['elena', 'Elena Petrova', '#D9466B', 'UW', 'IMA', 72, '4 friends in common'],
  ['diego', 'Diego Torres', '#2D8B57', 'UW', 'IMA', 19, 'Trains at IMA most evenings'],
  ['ava', 'Ava Thompson', '#3B6FD9', 'UW', 'Northlake Strength', 128, 'Lifts with Zoe'],
  ['jamal', 'Jamal Carter', '#C2610C', 'UW', 'IMA', 45, '6 friends in common'],
  ['mei', 'Mei Lin', '#8C4FD6', 'UW', 'IMA', 8, 'Started 8 days ago at IMA'],
  ['tomas', 'Tomás García', '#0E8F8F', 'WSU', 'Chinook Rec', 33, 'Follows Amara']
];

const CAPTIONS = {
  legs: ['Stairs are going to be a problem tomorrow.', 'Squats first, regrets later.', 'Leg day. Send help.'],
  push: ['Bench felt light today. Suspicious.', 'The bench was actually free for once.', 'Shoulders are cooked.'],
  pull: ['Eight clean pull-ups. Finally.', 'Grip gave out before I did.', 'Rows on rows.'],
  upper: ['Quick upper session between classes.', 'Arms day, no notes.'],
  full: ['Full body in 40 minutes.', 'A bit of everything today.', 'Almost skipped. Glad I didn\'t.'],
  cardio: ['5k before class. Slow, but done.', 'Treadmill and a podcast.', 'Legs said no, lungs said fine.'],
  core: ['Planks are longer than they sound.', 'Core day. Laughing hurts now.'],
  sport: ['Pickup runs. We lost every game.', 'Got laps in before it got busy.', 'Two hours of hoops counts.'],
  mobility: ['Stretching counts. I checked.', 'Slow flow after a long day.'],
  other: ['Twenty minutes is still a check-in.', 'Showed up. That was the whole plan.']
};
const COMMENTS = ['Let\'s go', 'Save me a rack Thursday?', 'You make this look easy', 'That streak though', 'Same time tomorrow?', 'Okay, I\'m going now', 'Proud of you', 'Drag me with you next time', 'This is the push I needed', 'Rest day who?'];
const LIFT_NAMES = ['Bench press', 'Squat', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-up', 'Incline dumbbell press', 'Romanian deadlift', 'Lat pulldown', 'Leg press', 'Dumbbell curl', 'Hip thrust', 'Lunge', 'Dip'];
const LIFT_SEED = { 'Bench press': [135, 185], 'Squat': [185, 255], 'Deadlift': [225, 315], 'Overhead press': [85, 115], 'Barbell row': [115, 155] };
const PR_LIFTS = [['squat', 'Squat', 225], ['bench', 'Bench press', 165], ['deadlift', 'Deadlift', 275], ['pull', 'Pull-up', 12]];

const FOOD_DB = [
  { name: 'Oatmeal with berries', kind: 'oats', kcal: 390, p: 15, c: 64, f: 9, keys: ['oat', 'porridge', 'berries'] },
  { name: 'Greek yogurt and granola', kind: 'oats', kcal: 320, p: 22, c: 38, f: 8, keys: ['yogurt', 'granola', 'parfait'] },
  { name: 'Veggie burrito bowl', kind: 'bowl', kcal: 640, p: 24, c: 88, f: 20, keys: ['burrito', 'bowl', 'rice', 'beans'] },
  { name: 'Avocado toast with egg', kind: 'toast', kcal: 430, p: 17, c: 36, f: 24, keys: ['avocado', 'toast'] },
  { name: 'Peanut butter toast', kind: 'toast', kcal: 380, p: 14, c: 40, f: 18, keys: ['peanut', 'pb', 'jelly'] },
  { name: 'Protein shake', kind: 'shake', kcal: 240, p: 32, c: 14, f: 5, keys: ['shake', 'protein', 'smoothie', 'whey'] },
  { name: 'Pasta with tomato sauce', kind: 'pasta', kcal: 610, p: 21, c: 98, f: 14, keys: ['pasta', 'spaghetti', 'noodle', 'penne'] },
  { name: 'Big salad with feta', kind: 'salad', kcal: 410, p: 16, c: 28, f: 26, keys: ['salad', 'greens', 'feta'] },
  { name: 'Falafel wrap', kind: 'wrap', kcal: 560, p: 20, c: 70, f: 22, keys: ['wrap', 'falafel', 'pita', 'sandwich'] },
  { name: 'Eggs and toast', kind: 'eggs', kcal: 420, p: 24, c: 30, f: 22, keys: ['egg', 'omelet', 'omelette', 'scramble'] },
  { name: 'Protein bar', kind: 'bar', kcal: 210, p: 20, c: 22, f: 7, keys: ['bar', 'snack'] },
  { name: 'Tofu stir-fry with rice', kind: 'bowl', kcal: 580, p: 30, c: 72, f: 18, keys: ['tofu', 'stir', 'fry', 'curry'] },
  { name: 'Cheese pizza, two slices', kind: 'pasta', kcal: 570, p: 24, c: 68, f: 22, keys: ['pizza'] },
  { name: 'Chicken and rice', kind: 'bowl', kcal: 620, p: 46, c: 70, f: 14, keys: ['chicken', 'turkey'] },
  { name: 'Banana', kind: 'bar', kcal: 105, p: 1, c: 27, f: 0, keys: ['banana', 'apple', 'fruit', 'orange'] }
];
const SLOTS = [['breakfast', 'Breakfast', 8.5], ['lunch', 'Lunch', 12.75], ['snack', 'Snack', 16], ['dinner', 'Dinner', 19.5]];

const BADGES = [
  { k: 'first', n: 'First check-in', icon: 'check', c: '#12996B', sh: 'circle', d: 'Post your first gym photo.' },
  { k: 'week', n: '7 day streak', icon: 'flame', c: '#FF8A1E', sh: 'shield', d: 'Stay on the clock for a week.' },
  { k: 'month', n: '30 day streak', icon: 'flame', c: '#F2B30C', sh: 'shield', d: 'Stay on the clock for a month.' },
  { k: 'hundred', n: '100 day streak', icon: 'flame', c: '#2F7BFF', sh: 'shield', d: 'One hundred days without missing a window.' },
  { k: 'fifty', n: '50 check-ins', icon: 'dumbbell', c: '#12162B', sh: 'hex', d: 'Fifty photos, fifty sessions.' },
  { k: 'pr', n: 'New best', icon: 'trend', c: '#E23B32', sh: 'star', d: 'Beat one of your lift records.' },
  { k: 'squad', n: 'Squad up', icon: 'users', c: '#0E8F8F', sh: 'circle', d: 'Join a squad.' },
  { k: 'saved', n: 'Saved by a pass', icon: 'pass', c: '#12996B', sh: 'hex', d: 'Let a rest pass rescue your streak.' }
];
