#!/usr/bin/env python3
"""
Fails when emoji appear in source outside the places where they are CHAT CONTENT.

Rule: the interface uses icons (components/ui/AppIcon.tsx, lucide-react). Emoji may only be seen in chats: message text,
stickers and reactions that people send each other. Tests, scripts, comments and console log lines are exempt.
Usage: python3 scripts/check-no-emoji.py [--list]   (exit code = number of offending lines)
"""
import os, re, sys

EMOJI = re.compile('[\U0001F000-\U0001FAFF☀-➿⭐⭕⬛⬜⬆⬇⤴⤵⌚⌛⏩-⏺Ⓜ▪▫▶◀◻-◾‼⁉〰〽㊗㊙]')
# typographic symbols that are not emoji
TYPOGRAPHIC = set('★☆✓✔✗✘✦✧✕✖•→←↑↓')

ROOTS = ['apps/web/src', 'apps/server/src', 'packages/common/src', 'packages/extension/src']
EXT = {'.ts', '.tsx', '.js', '.mjs', '.html', '.css'}
SKIP_DIRS = {'node_modules', '.next', 'dist', '__tests__', 'coverage'}

# Chat content lives here: emoji are allowed.
ALLOWED_PREFIXES = (
    'apps/web/src/components/chat/',           # chat UI, stickers, reaction picker, composer
    'apps/web/src/components/social/',         # reactions people send to each other
    'apps/web/src/components/voice/',          # call reactions
    'apps/web/src/components/games/emoji-charades/',  # Emoji Charades: the puzzle itself is a string of emoji (puzzle content, drawn by the puzzle / reveal cards)
    'apps/web/src/lib/chatStore.ts',           # chat messages / system lines inside chats
)
ALLOWED_FILES = {
    'apps/web/src/lib/reactionEmojis.ts',     # quick reactions players send each other in games
    'apps/server/src/games/emojiCharadesPuzzles.ts',  # Emoji Charades puzzle content: the emoji sequences are the puzzles (data, like chat stickers)
    'packages/common/src/types.ts',            # the list of reactions (content)
    'apps/web/src/components/plans/EventChat.tsx',  # plan event chat: quick-reaction emoji people send each other
}

def offending():
    out = []
    for root in ROOTS:
        for d, ds, fs in os.walk(root):
            ds[:] = [x for x in ds if x not in SKIP_DIRS]
            for f in fs:
                if os.path.splitext(f)[1] not in EXT or '.test.' in f:
                    continue
                p = os.path.join(d, f).replace(os.sep, '/')
                if p in ALLOWED_FILES or p.startswith(ALLOWED_PREFIXES):
                    continue
                try:
                    lines = open(p, encoding='utf-8').read().split('\n')
                except Exception:
                    continue
                for n, line in enumerate(lines, 1):
                    st = line.strip()
                    if st.startswith(('//', '*', '/*', '{/*')):
                        continue
                    if re.search(r'console\.(log|warn|error|info)\(', line):
                        continue
                    chars = [c for c in EMOJI.findall(line) if c not in TYPOGRAPHIC]
                    if chars:
                        out.append((p, n, ''.join(chars), st[:120]))
    return out

if __name__ == '__main__':
    found = offending()
    if '--list' in sys.argv or found:
        for p, n, chars, st in found:
            print(f'{p}:{n}  {chars}  {st}')
    print(f'{len(found)} line(s) with emoji outside chat content')
    sys.exit(min(len(found), 255))
