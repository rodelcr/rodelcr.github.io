# HANDOFF — rodelcr.github.io load performance — 2026-08-24

## TL;DR

Rodrigo reported the site "looked quite slow". Measured it end to end: **the
origin was never slow**. GitHub Pages serves the homepage with a median TTFB of
~100 ms. The drag was entirely front-end, on the cold-cache render path.

One commit, `a4b8b80` (authored 2026-08-16), live and verified at
<https://rodelcr.github.io/>.

| | |
|---|---|
| Origin TTFB | 23–190 ms, median ~100 ms — **not the problem** |
| MathJax | removed from every page: **−168 KB gzipped / −810 KB raw per page** |
| `polyfill.io` | removed — dead domain, one failed request per page eliminated |
| Preconnects | 1 → 3 (added `cdn.jsdelivr.net`, `fonts.googleapis.com`) |
| Lazy images | `/other/` 5, `/community-engagement/` 2; portrait stays eager |

**The two things most worth remembering** are §2 (polyfill.io was a *supply-chain*
problem, not just a perf one) and §5 (the responsive-image pipeline is working
correctly — do not "fix" the multi-MB originals).

---

## 1. What the measurements actually showed

Ten consecutive homepage fetches: TTFB 35–190 ms, total ~110 ms, HTML 10.8 KB.
After the change, six more fetches: TTFB 23–114 ms.

One early fetch did stall at **10.7 s total / 2.8 s TTFB**. It never reproduced
across ~19 subsequent fetches. Recorded as a transient DNS/TLS event on the
local network, **not** something this commit addresses. If Rodrigo reports
slowness again and the numbers below still look healthy, suspect the network
before suspecting the site.

Render-blocking inventory at the time of diagnosis — nine stylesheets across
three hosts, all of which must land before first paint:

```
cdn.jsdelivr.net   bootstrap.css, mdb.css, fontawesome, academicons,
                   github.css, native.css          (6 of 9)
fonts.googleapis   Roboto+Roboto Slab+Material Icons, IBM Plex Mono
self               main.css
```

Individual jsdelivr CSS files measured **1.0–2.8 s** on a cold connection.
Only `fonts.gstatic.com` was preconnected; the two hosts serving eight of the
nine files were not.

---

## 2. `polyfill.io` — this was a security finding, not just perf

The tag `<script defer src="https://polyfill.io/v3/polyfill.min.js?features=es6">`
was on **every page**, injected by `_includes/scripts/mathjax.html`.

That domain was taken over and served malware in June 2024. It is now
sinkholed:

```
$ host polyfill.io
polyfill.io has address 0.0.0.0
```

Because it carried `defer` it was **not** render-blocking, so it was not the
cause of the perceived slowness — but it was a failed request on every load and
a live supply-chain liability. Removed on those grounds regardless of perf.
MathJax 3 targets ES6 browsers directly and does not need it.

**Do not reinstate it.** If a polyfill is ever genuinely needed, use the
Cloudflare or Fastly mirror, never `polyfill.io`.

---

## 3. MathJax is now opt-in — and the gate was regression-tested

MathJax was loading on all four pages at 168 KB gzipped / 810 KB raw. At the
time of the change **no page, post, project, or bibliography entry on the site
used math at all** (`grep` for `$$`, `\(`, and `$` in `_bibliography/papers.bib`
all came back empty; there are no `layout: distill` pages).

`_includes/scripts/mathjax.html` now loads MathJax only when one of these holds:

1. the page sets `math: true` in front matter, **or**
2. `page.content` contains `$$`, **or**
3. `page.content` contains `math/tex`

`site.enable_math` remains the master switch and is still `true` in `_config.yml`.

**This was verified both ways before pushing**, using two throwaway pages built
and then deleted — silently breaking math later is the obvious failure mode of
this change:

| Test page | Result |
|---|---|
| front matter `math: true`, no delimiters | MathJax loads ✅ |
| no flag, body contains `$$E = mc^2$$` | MathJax loads ✅ |
| control `/research/` | MathJax absent ✅ |

So writing math on a page Just Works. The `math: true` flag is only needed when
math arrives through an include or is injected by JS, where the content check
cannot see it.

---

## 4. Files changed

| File | Change |
|---|---|
| `_includes/head.html` | `preconnect` for `cdn.jsdelivr.net` + `fonts.googleapis.com`, above the stylesheet block |
| `_includes/scripts/mathjax.html` | rewritten: per-page gate; `polyfill.io` tag deleted |
| `_includes/figure.html` | `loading="{{ include.loading \| default: 'lazy' }}"` + `decoding="async"` |
| `_layouts/about.html` | passes `loading="eager"` for the About portrait |

The portrait is deliberately **eager**: it is above the fold, and lazily
deferring it would push out LCP — the opposite of the goal.

---

## 5. Do NOT "fix" the multi-MB image originals

`assets/img` still contains originals up to 64 MB, and pages still reference
them in `<img src>`. **This is correct and is not a bug.** They are `<picture>`
fallbacks that only a browser without WebP support would ever fetch.

Verified live during this arc — every one of the 17 large originals has all
three WebP variants committed and serving:

```
20240628-10_29_16.jpg   64 MB original  →  65 KB  at -1400.webp
20221010-06_45_03.jpg   38 MB original  →  44 KB  at -1400.webp
tedx.jpg                33 MB original  → 199 KB  at -1400.webp
```

`git ls-files assets/img | grep -c webp` → **84 tracked variants, 0 untracked.**

This remains a *repo-weight* problem (§8.4 of the 2026-07-30 handoff), not a
performance one.

---

## 6. Verification performed

Per the safe-mode rule, everything was checked against the **live site**, not
`_site/`. Waited for `gh api repos/rodelcr/rodelcr.github.io/pages --jq .status`
to return `built` (~70 s), then:

```
page                      polyfill  mathjax  preconnect  lazy  eager
/                              0        0         3        0     1
/research/                     0        0         3        0     0
/other/                        0        0         3        5     0
/presentations/                0        0         3        0     0
/community-engagement/         0        0         3        2     0
```

`assets/observing/pawhuska-2026-06-24.html` confirmed **byte-identical** live
via `cmp` against the source — the night-vision page did not pick up the theme
or the starfield.

---

## 7. Outstanding / deliberately not done

1. **Never measured in a real browser.** Rodrigo declined the Chrome tool, so
   every number here is curl-side. The blocking-CSS cost — the main thing these
   preconnects target — shows up in render timing, which was never directly
   observed. **The preconnect benefit is therefore reasoned, not measured.**
   A Lighthouse or DevTools trace is the honest next step if this matters.
2. **mdbootstrap left alone** — 115 KB gzipped (`mdb.css` 27 KB + `mdb.js` 88 KB)
   sitting on top of Bootstrap proper. It is load-bearing for the theme;
   removing it is a redesign, not a perf tweak.
3. **The nine render-blocking stylesheets are still nine.** Only the handshake
   cost was addressed, not the file count. Self-hosting the CDN CSS, or
   subsetting FontAwesome/academicons (12 KB + 1 KB gz for a handful of icons),
   would cut real bytes and one whole host.
4. **The starfield was investigated and cleared** — capped at 600 stars × 2
   masses ≈ 72k distance calcs/s. Not a jank source. Note the caveat from the
   previous handoff still stands: the animation has never been observed running.
5. **Still untracked, still left alone**: `CLAUDE.md`,
   `assets/img/prof_pic_old.jpg`, `assets/pdf/CV_2025.pdf`,
   `assets/pdf/pubs_2025.pdf`. Note `CLAUDE.md` is *not* in the repo, so the
   conventions it records live only on this machine.

---

## 8. Reproducing the measurements

```bash
# origin timing — should be double-digit ms
for i in $(seq 1 10); do
  curl -sS -o /dev/null \
    -w "ttfb=%{time_starttransfer} total=%{time_total}\n" \
    https://rodelcr.github.io/
done

# per-resource weight as a browser actually receives it (note --compressed;
# without it jsdelivr reports raw size and MathJax looks like 810 KB, not 168 KB)
curl -sS --compressed -o /dev/null -w '%{size_download}\n' <url>

# confirm the responsive pipeline still covers every large original
for j in $(git ls-files assets/img | grep -iE '\.(jpg|jpeg|png)$'); do
  stem=$(basename "${j%.*}")
  for w in 480 800 1400; do
    [ -f "assets/img/${stem}-${w}.webp" ] || echo "MISSING ${stem}-${w}.webp"
  done
done
```

Local build env is unchanged — see §7 of `HANDOFF_website_redesign_2026-07-30.md`
(Homebrew Ruby + an overlay Gemfile adding `ostruct`). A local build runs
`jekyll-minifier`, which production does **not**; that is expected and is why
verification is done against the live URL.
