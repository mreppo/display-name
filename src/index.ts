// @reppo/display-name - the ONE display-name sanitiser for reppo.games.
//
// This file is canonical. It was extracted verbatim from `rallijs/src/mp/displayName.ts`, which
// held it while there was only one consumer; it now has four (rallijs, blockfall, reppo-scores,
// burtulis) and lives here instead of being copied into each of them. The history of every rule
// below is in that repo - see `mreppo/blockfall#54` for why the copies had to stop.
//
// Display names are FREE TEXT (Mareks' decision, carried from reppo-scores#1), so this does not
// police what someone calls themselves. It bounds the string and strips the characters that break
// a layout or spoof a leaderboard row, and nothing else.
//
// THE NAME IS DISPLAY ONLY. It is never a key, never an identity, and never trusted: the server
// identifies a player by its own id, and this string only ever gets rendered. Sanitising here is
// about what a name can DO to a screen, not about whether the player may use it.
//
// LATVIAN DIACRITICS SURVIVE, and that is the whole reason this is a module with tests rather than
// a regex inline in the join screen. A filter that turns Jānis into Janis - or worse, into Ja is -
// is more damaging than no filter at all: it silently corrupts the names of the audience the game
// is FOR. Every rule below is chosen to leave `\p{L}` alone.

/**
 * Longest display name, in CODE POINTS.
 *
 * Sixteen, at the top of the agreed 12-16 range: long enough for a real Latvian name with a surname
 * initial, short enough that a lobby row and a results row cannot be pushed out of shape.
 *
 * THIS IS THE CLIENT CAP, and it is the default rather than the law. `reppo-scores` stores 24 and
 * passes its own constant as `sanitizeDisplayName`'s second argument; the asymmetry is deliberate,
 * because a field that accepts more than the server keeps promises the player something that will
 * not be shown, and that is the direction that cannot lie. A server importing this should pass its
 * own cap and NOT assume `NAME_MAX` is its own.
 */
export const NAME_MAX = 16;

/**
 * Bound and clean a typed display name.
 *
 * Order matters and each step is here for a reason:
 *
 *  1. **NFC first.** A macron can arrive either composed (U+0101 `ā`) or decomposed (`a` + U+0304).
 *     Truncating the decomposed form can cut between the base letter and its combining mark, which
 *     renders as a bare `a` or a stray floating macron - the exact "mangled Jānis" failure. NFC
 *     composes it to one code point first, so the cut can never land inside a letter.
 *  2. **Strip Cc and Cf** (after step 3's first pass - see there). `Cc` is the C0/C1 control block (newlines, NUL); `Cf` is format
 *     characters - zero-width joiner and non-joiner, and the bidi overrides (U+202E and friends)
 *     that let a name reverse the text after it and impersonate another row on a leaderboard.
 *     Neither category contains a letter, so no diacritic is touched.
 *  3. **Collapse whitespace BEFORE stripping, then again after.** Order matters: a newline is both
 *     whitespace and a control character, so stripping first would delete it and weld the words
 *     either side together (`line<LF>break` -> `linebreak`, a different name rather than a cleaned
 *     one). Turning it into a space first keeps the boundary. The second collapse catches runs left
 *     behind once a zero-width character between two spaces is removed.
 *  4. **Truncate by CODE POINT, not by code unit.** `String.slice` counts UTF-16 units, so it can
 *     split a surrogate pair and leave a lone surrogate that renders as a replacement box. The
 *     spread splits on code points, so the worst a cut can do is end the name early.
 *
 *  5. **Refuse a name with nothing left to look at.** See `isEntirelyInvisible` - this is the only
 *     step that can turn a non-empty input into an empty result, and it fires only when EVERY
 *     surviving character is invisible.
 *
 * Pure and total: any input, including an empty one, returns a safe string. An empty result is
 * legal - the caller decides whether a nameless player is acceptable.
 *
 * @param max Cap in CODE POINTS, defaulting to `NAME_MAX` (16). Passed explicitly by callers that
 * are not a game client - see the note on `NAME_MAX`. The cleaning rules are identical whatever the
 * cap is, and that is the point: the cap is a policy each caller owns, the rules are not.
 */
export function sanitizeDisplayName(raw: string, max: number = NAME_MAX): string {
  const cleaned = raw
    .normalize('NFC')
    // Whitespace-ish controls become a SPACE before the strip, not after. Deleting them first
    // merges the words either side - `line\nbreak` would come back as `linebreak`, which is a
    // different name, not a cleaned one.
    .replace(/\s+/gu, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/ +/gu, ' ')
    .trim();
  const capped = [...cleaned].slice(0, Math.max(0, max)).join('');
  // AFTER the cap, never before. Sixteen braille blanks followed by a `J` is all-invisible once
  // truncated, and checking first would pass it through on the strength of a letter that the very
  // next line throws away.
  return isEntirelyInvisible(capped) ? '' : capped;
}

/**
 * Does this string consist ENTIRELY of characters that render as nothing? (issue #110)
 *
 * The gap this closes: `Cc`/`Cf` catches the control and format blocks, but not every invisible
 * character lives there. U+3164 HANGUL FILLER is category `Lo` - a *letter* - and U+2800 BRAILLE
 * PATTERN BLANK is `So`. Neither is whitespace, so nothing above touches them, and a name built
 * only from them survives as a non-empty string that shows nothing. In a lobby that is one odd
 * row for one race; on a `reppo-scores` board it is a permanent public entry holding a rank with
 * nothing to attribute it to.
 *
 * NOT A CODE-POINT BLACKLIST, and that distinction is the whole design. Banning U+2800 outright
 * would cost a real braille user a real character, which is the `Jānis` -> `Janis` mistake wearing
 * a different hat. This asks a question about the WHOLE name instead: mix one visible character in
 * and every invisible one beside it is left completely alone. Only the all-invisible case - the
 * one with no legitimate reading - comes back empty.
 *
 * `Default_Ignorable_Code_Point` is the Unicode property for exactly this, so the set is not
 * hand-maintained and picks up future additions on a Node upgrade: it holds the four Hangul
 * fillers, the Khmer inherent vowels, the soft hyphen and the rest. **U+2800 is the one that is
 * genuinely not default-ignorable** - it is a real braille cell that happens to have no raised
 * dots - so it is named explicitly, and it is the only literal here.
 *
 * A *mostly* invisible name is deliberately still allowed. It has readings this does not
 * (padding, spacing), and starting at the case with none keeps the rule one a player can be told.
 */
function isEntirelyInvisible(s: string): boolean {
  // Empty is vacuously true, which is correct: it returns '' either way.
  for (const ch of s) {
    if (!INVISIBLE.test(ch)) return false;
  }
  return true;
}

/** @see isEntirelyInvisible - a Unicode property plus the one character it does not cover. */
const INVISIBLE = /[\p{Default_Ignorable_Code_Point}\u2800]/u;
