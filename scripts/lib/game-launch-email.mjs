// Pure helpers for the "your game is live" email (no network, no database), unit tested in scripts/__tests__.
// `hostNote` says which pass is needed to HOST the game (guests of any pass can always join).
const VIP_NOTE = "Hosting is part of Watch+ (VIP Pass). Joining a friend's game is free for everyone.";
const MURDER_NOTE = "Hosting is part of the Creator Pass. Joining a friend's mystery with its room code is free for everyone.";
const CREATOR_NOTE = "Hosting is part of the Creator Pass. Joining a quiz with its room code is free for everyone.";
const TOURNAMENT_NOTE = "Organising is part of the Creator Pass. Joining and playing in a tournament with its room code is free for everyone.";
export const GAME_EMAILS = {
  imposter: {
    title: 'Imposter',
    tagline: 'Everyone knows the secret word except one. Find the bluffer.',
    players: '4-8 players',
    path: '/games/imposter',
    hostNote: VIP_NOTE,
    bullets: [
      'Crew members see the secret word, the imposter only gets the category.',
      'Give one-word clues, argue it out, then vote the bluffer out.',
      'Caught? The imposter still gets one last guess at the word.'
    ]
  },
  'emoji-charades': {
    title: 'Emoji Charades',
    tagline: 'Guess the movie or show from a few emoji, faster than your friends.',
    players: '2-8 players',
    path: '/games/emoji-charades',
    hostNote: VIP_NOTE,
    bullets: [
      'A new emoji puzzle every round: Hollywood, Bollywood and TV.',
      'Hints unlock as the timer runs down, faster solves score more.',
      'Race your friends live and climb the leaderboard.'
    ]
  },
  mafia: {
    title: 'Mafia Night',
    tagline: 'Night falls, the mafia strikes, the town must find them.',
    players: '5-10 players',
    path: '/games/mafia',
    hostNote: VIP_NOTE,
    bullets: [
      'Secret roles: Mafia, Doctor, Detective and Villagers.',
      'Act at night, discuss and vote by day.',
      'Last side standing wins.'
    ]
  },
  'quiz-show': {
    title: 'Quiz Show Studio',
    tagline: 'Host a live quiz for your community with your own questions.',
    players: 'Up to 30 players',
    path: '/games/quiz-show',
    hostNote: CREATOR_NOTE,
    bullets: [
      'Write your own multiple choice and buzzer questions, or start from the Movie Night pack.',
      'You run the show: control the pace, judge the buzzers and reveal the answers.',
      'Players join with a room code and race up a live leaderboard.'
    ]
  },
  'murder-mystery': {
    title: 'Murder Mystery Night',
    tagline: 'A scripted whodunit for your whole group. Everyone is a suspect.',
    players: '6-12 players',
    path: '/games/murder-mystery',
    hostNote: MURDER_NOTE,
    bullets: [
      'Each player gets a secret character with a motive, an alibi and something to hide. One of you is the murderer.',
      'Four clue rounds: public evidence for everyone, private clues for a few. Share what you know, or whisper it.',
      'Secretly accuse the murderer at the end and score for every right call.'
    ]
  },
  tournament: {
    title: 'Tournament Arena',
    tagline: 'Run a knockout bracket for your community: 1v1 matches all the way to a champion.',
    players: '4-32 players',
    path: '/games/tournament',
    hostNote: TOURNAMENT_NOTE,
    bullets: [
      'Pick Tic Tac Toe, Four in a Row or Chess, seed the players and start the bracket. Byes and rounds are handled for you.',
      'Every match opens in its own game room for the two players. Results come from the game itself, and a drawn game is replayed.',
      'Follow the live bracket, watch matches with your friends and finish with a champion screen.'
    ]
  }
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Builds subject, plain text and HTML. `sender` is the company block printed in the footer (required for a bulk mail). */
export function renderGameLaunchEmail({ gameId, name, webBase, sender }) {
  const g = GAME_EMAILS[gameId];
  if (!g) throw new Error(`No email template for game "${gameId}"`);
  const url = `${String(webBase).replace(/\/+$/, '')}${g.path}`;
  const hello = name ? `Hi ${String(name).split(/\s+/)[0]},` : 'Hi,';
  const subject = `${g.title} is live on Watch. You asked us to tell you`;
  const reason = `You are getting this one-time email because you tapped "Notify me" for ${g.title} on Watch. We will not send you a reminder.`;
  const vip = g.hostNote || VIP_NOTE;
  const footerLines = [sender.companyName, sender.address].filter(Boolean);

  const text = [
    hello, '',
    `${g.title} is now live on Watch (${g.players}).`,
    g.tagline, '',
    ...g.bullets.map((b) => `- ${b}`), '',
    vip, '',
    `Play now: ${url}`, '',
    reason,
    ...footerLines,
    sender.contactEmail ? `Questions or want fewer emails? Write to ${sender.contactEmail}.` : ''
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f8fa;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
<tr><td style="background:#0c0d12;padding:22px 24px;">
<div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#ee1d49;font-weight:700;">New game on Watch</div>
<div style="font-size:30px;line-height:1.15;font-weight:800;color:#ffffff;margin-top:6px;">${esc(g.title)} <span style="color:#ee1d49;">is live</span></div>
<div style="font-size:13px;color:#a1a1aa;margin-top:6px;">${esc(g.players)} &middot; real friends, no bots</div>
</td></tr>
<tr><td style="padding:22px 24px 8px 24px;">
<p style="margin:0 0 10px 0;font-size:15px;">${esc(hello)}</p>
<p style="margin:0 0 14px 0;font-size:15px;line-height:1.5;">${esc(g.tagline)} You asked us to tell you when it launched, so here it is.</p>
<ul style="margin:0 0 16px 18px;padding:0;font-size:14px;line-height:1.6;color:#3f3f46;">
${g.bullets.map((b) => `<li>${esc(b)}</li>`).join('\n')}
</ul>
<p style="margin:0 0 18px 0;font-size:13px;line-height:1.5;color:#71717a;">${esc(vip)}</p>
<a href="${esc(url)}" style="display:inline-block;background:#ee1d49;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:12px;">Play ${esc(g.title)}</a>
<p style="margin:14px 0 0 0;font-size:12px;color:#71717a;word-break:break-all;">Or open: <a href="${esc(url)}" style="color:#185df2;">${esc(url)}</a></p>
</td></tr>
<tr><td style="padding:18px 24px 22px 24px;border-top:1px solid #f4f4f5;margin-top:16px;">
<p style="margin:0 0 6px 0;font-size:11px;line-height:1.5;color:#a1a1aa;">${esc(reason)}</p>
<p style="margin:0;font-size:11px;line-height:1.5;color:#a1a1aa;">${footerLines.map(esc).join('<br>')}${sender.contactEmail ? `<br>Questions or want fewer emails? Write to ${esc(sender.contactEmail)}.` : ''}</p>
</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html, url };
}
