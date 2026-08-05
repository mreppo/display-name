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
export declare const NAME_MAX = 16;
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
export declare function sanitizeDisplayName(raw: string, max?: number): string;
//# sourceMappingURL=index.d.ts.map