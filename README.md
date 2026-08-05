# @reppo/display-name

The one display-name sanitiser for [reppo.games](https://www.reppo.games/). It bounds and cleans a
free-text player name, and above all it never corrupts a Latvian one.

```sh
npm install github:mreppo/display-name#v1.0.0
```

It is a **git dependency pinned to a tag**, not an npm package - see
[Why a git dependency](#why-a-git-dependency-and-not-the-registry). Consumers declare it as:

```json
"@reppo/display-name": "github:mreppo/display-name#v1.0.0"
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

## Why a git dependency, and not the registry

**Please do not "fix" this by publishing it.** The choice is deliberate and it is not laziness.

The one hard constraint is that every consumer deploys through **Cloudflare Workers Builds**, which
runs `npm ci` with no credentials of its own. That is what ruled out a *private* dependency, and it
already cost `reppo-realtime` and `reppo-scores` their push-to-deploy
([`reppo-games#29`](https://github.com/mreppo/reppo-games/issues/29)). A **public git URL satisfies
it exactly as well as a public registry entry** - no account, no org, no scope to own.

What the registry would add is thin here:

| | |
|---|---|
| **Semver ranges** | Actively unwanted. All four consumers must agree on the same rules; a range lets them drift apart quietly, which is the entire failure this package exists to kill. A pinned tag makes every bump a deliberate, reviewable act in each repo. |
| **Install caching** | A 6 kB tarball from GitHub. |
| **Dependabot** | Disabled on personal repos here by policy - it is noise. |

**`dist/` is committed** for the same reason: a git install runs no build, so the package must ship
ready to import. No consumer runs `tsc` during `npm ci`, which is one less thing to fail inside
Workers Builds. CI rebuilds and asserts `dist/` matches `src/` on every push, because a committed
build that silently goes stale would ship the *old* rule to every consumer while the tests - which
run against `src` - stayed green.

**This is not a one-way door.** The package name, the `exports` map and `publishConfig.access:
public` are all left exactly as a registry package needs them. If the registry ever earns its keep,
`npm publish` is one command and nothing renames - consumers change a version string and nothing
else.

## Pinning

The dependency points at a **tag**, never a branch. `#main` would be a moving reference, which
reintroduces silent drift wearing a different hat: four repos claiming the same dependency and
resolving to different code depending on when each last installed.

Bumping is: tag here, then update the four consumers deliberately.

## Licence

MIT.
