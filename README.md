# Trading without a tie / Трейдинг без галстука

Static personal hub and copy-trading guide: 11 languages, no framework, external fonts or analytics.

## Deployment

GitHub Pages uses GitHub Actions, not the repository root. The workflow .github/workflows/pages.yml publishes the contents of trading-without-tie.zip. Older loose HTML/CSS files in the repository are historical and are not deployed. Do not edit those files to update the live website.

Build and check the local project, run prepare_release.py (or prepare_github.py), then replace trading-without-tie.zip on main. The workflow automatically publishes it at the existing URL. Do not flatten the archive: language and instruction directories must remain intact.

Russian at root; English /en/, Spanish /es/, Brazilian Portuguese /pt-br/, Turkish /tr/, Hindi /hi/, Vietnamese /vi/, Thai /th/, Filipino /fil/, Malay /ms/, Indonesian /id/.

Each language has a home page, trading.html, instructions/, instructions/step-1/ through step-3/, privacy/, terms/, risks/, and legal/. Internal links keep the tab; broker and other external links open a new tab. Steps unlock sequentially; progress exists only in the open guide. No data is submitted by the guide. Individual step URLs remain available but are not advertised inside the sequential guide.

Each language has a 1200x630 JPEG social banner, static Open Graph/Twitter metadata, canonical URL and hreflang links. Favicon adapts to light/dark mode. Language switching preserves the page and supported step fragments.

Current base: https://ural66-design.github.io/trading-without-tie/
Future base: https://www.vladimir1.com/ (domain/DNS are not configured by this update).

The static generator is maintained locally: build_site.py, locales.py, locales_extra.py, privacy_details.py and site-config.json. For custom-domain release, generate with --production-domain to update metadata/sitemap, then configure the verified domain in Pages. Relative navigation requires no rewrite.
