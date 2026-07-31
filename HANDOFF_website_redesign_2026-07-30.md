# HANDOFF — rodelcr.github.io redesign — 2026-07-30

## TL;DR

The site was restyled around an animated gravitational-lensing starfield and
shipped to production. Seven commits, `aade709 → cc6f0e5`, all live at
<https://rodelcr.github.io/>.

| | |
|---|---|
| Starfield | `assets/js/starfield.js`, vanilla Canvas 2D, ~350 lines |
| Palette | deep-night sky / paper "plate" day, true channel-wise inverses |
| Contact card | `/contact/` serves a downloadable vCard 3.0 with embedded photo |
| GitHub link | removed site-wide |
| Image payload | profile picture **4,646,463 → 424,380 bytes** (10×) |
| About page | title now "incoming NSF Astronomy and Astrophysics Postdoctoral Fellow" |

**The single most important thing recorded here** is the GitHub Pages safe-mode
finding in §3. It explains a class of bug that will recur.

---

## 1. What shipped

| Commit | |
|---|---|
| `eb8d1e1` | Lensed starfield background, night/plate palette, mono typography |
| `9b9797a` | Dropped GitHub link; added downloadable contact card |
| `8e2e1a8` | Light-mode starfield made a true inversion of the night field |
| `822e00b` | Merge of `redesign/starfield` to master (first deploy) |
| `c10a601` | Committed responsive WebP variants — images were loading at full size |
| `9c08b6f` | Raised quality to a ~10× reduction; DPR-aware sources |
| `cc6f0e5` | Rodrigo's About-page edit (NSF AAPF) |

Branches `redesign/starfield` and `contact-private` were deleted after merge /
abandonment. Master is the only branch.

---

## 2. The starfield — `assets/js/starfield.js`

A field of twinkling stars with one or two invisible point masses drifting
through it. Stars within `3.2 θ_E` of a mass are deflected using the **actual
point-lens solution**, not an approximation:

- image positions `θ± = (β ± √(β² + 4θ_E²)) / 2`
- magnification `μ = θ⁴ / |θ⁴ − θ_E⁴|`
- tangential stretch `1/|1 − (θ_E/θ)²|`, radial thinning `1/(1 + (θ_E/θ)²)`
- the parity-flipped counter-image is drawn inside the ring

Verified numerically: `θ₊+θ₋ = β`, `θ₊θ₋ = −θ_E²`, and the per-image
magnifications sum to the analytic total `(u²+2)/(u√(u²+4))` to six decimals at
every separation tested. Outside the cutoff `μ < 1.01`, so distant stars fall
through to plain twinkling points.

Scroll velocity feeds a decaying temperature scalar that deepens the twinkle and
inflates `θ_E` — the same trick as the reference site, <https://malbergo.me>,
whose background is drifting p5.js molecules.

**Deliberately not p5.js-in-an-iframe** like the reference: an iframe cannot read
the parent's `html[data-theme]`, which the inverted light mode needs, and it
would add ~900 KB of CDN.

Tunables are named constants at the top of the file. The three worth touching
are star density (`AREA_PER_STAR`), `RING_GLOW`, and the surface alpha in
`_sass/_themes.scss`. **Tune the surface panel before star density** — legibility
comes from prose sitting on `--global-surface-color`, not from a sparse field.

Honours `prefers-reduced-motion` with a single static frame (verified: 0
animation frames scheduled, 0 scroll listeners), pauses while the tab is hidden,
caps DPR at 2.

### Light mode

Day star colours are derived with Sass `invert()` from the night ramp, so the
themes stay exact inverses if the night colours are retuned
(`#fff3d6 → #000c29`, `#cfe2ff → #301d00`).

Inverting the ink alone was **not enough**. Measured on the rendered canvas, the
day field sat at alpha 26.7 against night's 77.3 — about a third of the on-page
contrast, which read as washed out rather than as a negative. The alphas now
match: ink-to-paper delta ~68 against star-to-sky ~67.

---

## 3. GitHub Pages runs in SAFE MODE — read this before debugging anything

`gh api repos/rodelcr/rodelcr.github.io/pages` reports `build_type: legacy`,
`source: {branch: master, path: /}`. GitHub builds the site **itself**, from
`master`, in safe mode — only whitelisted plugins execute.

Consequences:

- **`.github/workflows/deploy.yml` has never run.** Only `pages-build-deployment`
  appears in the Actions history. `bin/deploy` and the `gh-pages` branch are dead
  code. Deleting them is safe and would remove a real source of confusion.
- **`jekyll-imagemagick`, `jekyll-minifier`, `jekyll/scholar`, `jekyll-archives`,
  `jekyll-paginate-v2`, `jekyll-twitter-plugin` etc. do not run in production**,
  despite being listed in `_config.yml`.
- A local `bundle exec jekyll build` therefore does **not** reproduce production.
  Anything that depends on a non-whitelisted plugin will work locally and fail
  live. Verify against `https://rodelcr.github.io/`, not `_site/`.

This is what caused the image bug in §4.

---

## 4. Responsive images — `bin/make-responsive-images.sh`

`_includes/figure.html` emits `<source srcset="<name>-<width>.webp">`, which
`jekyll-imagemagick` is meant to generate. Per §3 it never runs, so **every one
of those URLs 404'd in production**. The browser matched a source, failed to
decode the 404 body, fired figure.html's `onerror` handler to strip the sources,
and only then fetched the original. A wasted round trip followed by a very large
download — the profile picture was 4,646,463 bytes for a ~200 px slot.

Fixed by committing the variants (84 files, 10.3 MB, against 326 MB of
originals). **Re-run `bin/make-responsive-images.sh` after adding or replacing
any image in `assets/img/`, or the new one silently falls back to full size.**
It skips up-to-date files; `--force` regenerates.

Two further fixes in the same area:

- A **catch-all `<source>` with no media query.** Every source was a `max-width`
  match, so viewports wider than the largest configured width matched none and
  fell through to the original — desktop was downloading the full file every
  time.
- **DPR-aware density ladders.** Media queries are in CSS pixels, so a ~390pt
  phone at 3× DPR matched the 480px breakpoint and painted that file into ~1170
  device pixels. It was *under-resolved*, which was as much of the perceived
  problem as compression. Each breakpoint now offers 1x/2x/3x candidates.

Quality is 90, chosen by measurement on `prof_pic.jpg` (4,646,463 bytes):

| width | q82 | q90 | q95 |
|---|---|---|---|
| 800px | 117 KB (39×) | 176 KB (26×) | 266 KB (17×) |
| 1400px | 261 KB (17×) | **424 KB (10×)** | 695 KB (6×) |

A 3× phone lands on the 1400px file — both the 10× point and enough pixels for
the slot. Verified in-browser: `currentSrc` resolves to `prof_pic-1400.webp`,
naturalWidth 1400; the original JPEG is never fetched.

---

## 5. Contact card — `bin/make-vcard.sh`

`/contact/` links `assets/vcard/rodrigo-cordova-rosado.vcf`: vCard 3.0 (both
mobile OSes import 3.0 reliably), folded at 75 octets with CRLF per RFC 2426,
embedding a 400px photo cropped to match the page's `object-position: center 8%`.

Contents are only what the site already publishes — name, title, org, email,
site and ORCID URLs. **No phone or postal address**: not in the repo, not to be
invented.

The link deliberately has **no `download` attribute** — on iOS Safari that
diverts the file into Files instead of handing it to Contacts. There is a comment
saying so in `_pages/contact.md`; do not "fix" it.

Two gotchas encoded in the script, both of which broke it during development:

- `sips` applies operations in a **fixed internal order**, not argument order, so
  a single invocation resizes *before* it crops. Cropping and resizing need
  separate passes or you get a 266px image.
- `printf | fold` emits **no trailing newline**, so `END:VCARD` was concatenated
  onto the base64 payload — corrupting both the photo and the terminator. The
  script now asserts line length ≤76 and the presence of `END:VCARD`.

---

## 6. Decision log — the private contact page (do not rebuild)

A second contact page carrying the mobile number (+ WhatsApp / tel links, its own
vCard variant with `TEL;type=CELL`) was built, moved behind a random token
`/c/<hex>/`, and then **deliberately abandoned**. Rodrigo's call, on the grounds
that it was dangerous.

The reasoning, so a future session does not helpfully recreate it: this repo is
**public** and Pages serves from `master`, so an "unlisted" page is not private.
`noindex` + `sitemap: false` + a random path keep it out of search results and
stop casual URL-guessing; none of them restrict access, and the number would have
entered public git history permanently.

It was never pushed. The branch was deleted and `git reflog expire --expire=now
--all && git gc --prune=now` was run, so no trace remains. Verified: no match for
the number in history, working tree, or `_site/`.

If a phone number is ever wanted on a card again, the right shape is a **local**
`.vcf` that Rodrigo AirDrops or texts — not a repo file.

---

## 7. Local build environment (this is not obvious)

The site had **only ever been built by CI**; there was no working local build.

- macOS ships Ruby 2.6, too old for the `Gemfile`. Homebrew Ruby was installed
  (keg-only, does not shadow `/usr/bin/ruby`): prefix `PATH` with
  `/opt/homebrew/opt/ruby/bin`.
- Ruby 4 dropped `ostruct` from the default gems and `jekyll-twitter-plugin`
  needs it. Rather than touch the tracked `Gemfile` (CI uses Ruby 3.0.2, where
  `ostruct` is still a default gem), builds use an **overlay Gemfile** that
  `eval_gemfile`s the real one and adds `ostruct`. It lives in the session
  scratchpad along with a launcher, `serve-starfield.sh`. **Both are outside the
  repo and will not survive.** Recreate if needed — the overlay is four lines.
- `convert: command not found` warnings on every build are expected and harmless
  (ImageMagick absent locally; irrelevant in production per §3).
- Sass deprecation warnings (`@import`, `lighten()`) are pre-existing al-folio
  code, not introduced here.

---

## 8. Outstanding / known warts

1. **Never verified: the starfield in motion.** The automated browser tab
   reported `document.hidden: true` permanently, so `requestAnimationFrame` never
   ran. Single frames, theme inversion, and the reduced-motion path were all
   verified; the animation itself has only been verified by construction.
   Likewise **375px mobile layout** and **real FPS** (scripting cost is ≤0.1 ms
   per frame, but that excludes rasterization).
2. **Title inconsistency.** About now says "incoming NSF Astronomy and
   Astrophysics Postdoctoral Fellow". `_pages/contact.md` and
   `bin/make-vcard.sh` still say plain "Postdoctoral Fellow" — not wrong, but
   less specific. Left alone deliberately: the wording of "incoming" is
   Rodrigo's call. Change `TITLE=` in the script and regenerate if wanted.
3. **`prof_pic_old-*.webp` are committed but their source is not.**
   `assets/img/prof_pic_old.jpg` is untracked, so three derivative files
   (~250 KB) reference a file not in the repo. Harmless but confusing; either
   `git rm` them or track the source.
4. **`.git` is 468 MB**, `assets/img` is 326 MB, with single photos up to 64 MB.
   Downscaling the originals would shrink the repo enormously. The variants mean
   originals are now rarely fetched, so this is no longer a *performance*
   problem — only a repo-weight one.
5. **`deploy.yml` / `bin/deploy` / `gh-pages` are dead code** per §3.
6. Untracked and left alone throughout: `CLAUDE.md`, `assets/pdf/CV_2025.pdf`,
   `assets/pdf/pubs_2025.pdf`, `assets/img/prof_pic_old.jpg`.

---

## 9. Verifying a change end to end

```bash
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
export BUNDLE_GEMFILE=/path/to/overlay/Gemfile     # see §7
bundle exec jekyll build                            # ignore ImageMagick warnings
bundle exec jekyll serve --port 4000 --host 0.0.0.0 # 0.0.0.0 so a phone can reach it
```

Then, because local ≠ production (§3), confirm against the live site after
deploy. Routes: `/`, `/research/`, `/presentations/`, `/community-engagement/`,
`/other/`, `/contact/`. Two unlisted things that must keep working:

- `/contact/` — no nav entry, but a normal Jekyll page.
- `assets/observing/pawhuska-2026-06-24.html` — a self-contained red-on-black
  night-vision itinerary with **no front matter and no `main.css`**. Jekyll
  copies it byte-identically. It must never pick up the starfield or the site
  palette; `cmp` it against the source after any theme change.

Deploy is `git push origin master`; wait for
`gh api repos/rodelcr/rodelcr.github.io/pages --jq .status` to return `built`.
