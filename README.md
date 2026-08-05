# @reppo/display-name

The one display-name sanitiser for [reppo.games](https://www.reppo.games/). It bounds and cleans a
free-text player name, and above all it never corrupts a Latvian one.

```sh
npm install @reppo/display-name
```

```ts
import { sanitizeDisplayName, NAME_MAX } from '@reppo/display-name'

sanitizeDisplayName('  Jānis   Bērziņš  ') // 'Jānis Bērziņš'
sanitizeDisplayName('a'.repeat(50)).length // 16 - NAME_MAX, in CODE POINTS
sanitizeDisplayName('evil‮name') // 'evilname' - the bidi override is gone
sanitizeDisplayName('ㅤ⠀') // '' - nothing to look at
```

## What it is for

Display names on reppo.games are free text. This does **not** police what somebody calls
themselves - it bounds the string and removes the characters that can break a layout or spoof a
leaderboard row, and nothing else. The name is display-only: it is never a key, never an identity,
and never trusted.

**Latvian diacritics survive every rule**, which is the entire reason this is a package with tests
rather than a regex inlined in a join screen. A filter that turns `Jānis` into `Janis` - or worse,
into `Ja is` - is more damaging than no filter, because it silently corrupts the names of the
audience these games are *for*.

## The rules, in order

1. **NFC first.** A macron can arrive composed (`ā`) or decomposed (`a` + U+0304). Truncating the
   decomposed form can cut between the letter and its mark. Composing first makes that impossible.
2. **Whitespace collapses to a single space *before* the control strip, then again after.** A
   newline is both whitespace and a control character; stripping first would delete it and weld the
   words either side together - `line<LF>break` becoming `linebreak` is a different name, not a
   cleaned one.
3. **`Cc` and `Cf` are removed** - the control block, the zero-width joiners, and the bidi
   overrides (U+202E and friends) that let a name reverse the text after it. Neither category
   contains a letter.
4. **Truncation counts code points, not UTF-16 units**, so a cut can never split a surrogate pair
   into a replacement box.
5. **A name with nothing visible left in it comes back empty.** See below.

Pure and total: any input returns a string. An empty result is legal - **the caller decides**
whether a nameless player is acceptable.

## The invisible-name rule is not a blacklist

`Cc`/`Cf` misses invisible characters that live elsewhere: U+3164 HANGUL FILLER is category `Lo` -
a *letter* - and U+2800 BRAILLE PATTERN BLANK is `So`. A name built only from those survives every
rule above as a non-empty string that shows nothing. On a leaderboard that is a permanent public
row holding a rank with nothing to attribute it to.

Banning those characters would cost a real braille user a real character, which is the
`Jānis` → `Janis` mistake in a different hat. So the rule asks about the **whole name** instead:

| input | result | |
|---|---|---|
| `⠀⠀⠀` | `''` | every character invisible - refused |
| `⠃⠁⠀` | `⠃⠁⠀` | real braille, untouched |
| `ㅤJānis` | `ㅤJānis` | one visible character is enough |

The set is Unicode's own `Default_Ignorable_Code_Point` property - so it is not hand-maintained and
picks up future additions - plus U+2800 named explicitly, because a blank braille cell is a real
character and genuinely not default-ignorable. The check runs **after** truncation: `NAME_MAX`
blanks followed by a `J` is all-invisible once the `J` is cut.

A *mostly* invisible name is deliberately still allowed. It has readings this case does not.

## `NAME_MAX` is a client cap, and servers may be looser

`NAME_MAX` is **16 code points** - long enough for a real Latvian name with a surname initial,
short enough that a lobby row cannot be pushed out of shape.

The `reppo-scores` server stores up to **24** and keeps that as its own constant. That asymmetry is
deliberate: **a client field must never accept more than the server keeps**, because that is the
direction that cannot lie to a player. If you are writing a server, import `sanitizeDisplayName`
for the cleaning and apply your own cap - do not assume `NAME_MAX` is yours.

## Why this is a package

It used to be a file copied into every repo that needed it. Two implementations of one rule drift,
and the drift surfaces as a player seeing their own name rendered one way in a lobby and another on
a leaderboard - on the same site. At three copies that was a tracked risk
([`mreppo/blockfall#54`](https://github.com/mreppo/blockfall/issues/54)); the fourth consumer made
it a package instead.

Public on npm on purpose: it is a small string sanitiser with no secrets and no business logic, and
a private dependency would break `npm ci` for the Cloudflare Workers Builds deploys that every
consumer relies on.

## Licence

MIT.
