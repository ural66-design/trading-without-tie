const assert = require('node:assert/strict');
const { readFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const assets = path.resolve(__dirname, '../../site/assets');
const output = path.resolve(process.argv[2] || path.join(__dirname, '../../../deliverables/og-stage-1-large'));
const dataURL = (mime, bytes) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;

async function embedFonts() {
  const directory = path.join(assets, 'fonts');
  let css = await readFile(path.join(directory, 'fonts.css'), 'utf8');
  for (const [, name] of css.matchAll(/url\((font-\d+\.woff2)\)/g)) {
    const font = await readFile(path.join(directory, name));
    css = css.replace(`url(${name})`, `url("${dataURL('font/woff2', font)}")`);
  }
  return css;
}

async function transparentMark(page, filename, backgroundFills) {
  const original = await readFile(path.join(__dirname, 'originals', filename), 'utf8');
  const derived = await page.evaluate(({ original, backgroundFills }) => {
    const svg = new DOMParser().parseFromString(original, 'image/svg+xml').documentElement;
    if (svg.localName !== 'svg') throw Error('Invalid original SVG');
    const tiles = [...svg.children].filter(el => el.localName === 'rect' && backgroundFills.includes(el.getAttribute('fill')));
    if (tiles.length !== backgroundFills.length) throw Error('Unexpected logo backgrounds');
    const signature = node => [node.nodeName, node.nodeValue,
      [...(node.attributes || [])].map(attr => [attr.name, attr.value]), [...node.childNodes].map(signature)];
    const unchanged = [...svg.children].filter(el => !tiles.includes(el)).map(signature);
    for (const tile of tiles) tile.remove();
    const fixture = document.createElement('div');
    fixture.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    fixture.append(svg);
    document.body.append(fixture);
    const { x, y, width, height } = svg.getBBox();
    fixture.remove();
    if (!(width > 0 && height > 0)) throw Error('Empty logo');
    svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    if (JSON.stringify([...svg.children].map(signature)) !== JSON.stringify(unchanged)) {
      throw Error('Original mark geometry changed');
    }
    return new XMLSerializer().serializeToString(svg);
  }, { original, backgroundFills });
  return dataURL('image/svg+xml', derived);
}

async function render(page, item, lang, image, portrait) {
  return page.evaluate(async ({ item, lang, image, portrait }) => {
    const h1 = document.querySelector('h1');
    const p = document.querySelector('p');
    const media = document.querySelector('.media');
    const mark = document.querySelector('.mark');
    document.documentElement.lang = lang;
    document.body.dataset.theme = item.theme;
    document.body.style.setProperty('--portrait', `url("${portrait}")`);
    h1.textContent = item.title;
    p.textContent = item.description;
    media.dataset.image = item.image;
    mark.src = image;
    const faces = await Promise.all([h1, p].map(el => {
      const style = getComputedStyle(el);
      return document.fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, el.textContent);
    }));
    await Promise.all([document.fonts.ready, mark.decode()]);
    const box = el => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return [x, y, width, height];
    };
    const line = el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rect = range.getBoundingClientRect();
      return { width: rect.width, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
        lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) };
    };
    const panel = box(document.querySelector('.panel'));
    const copy = box(document.querySelector('.copy'));
    const markStyle = getComputedStyle(mark);
    return {
      panel, copy, media: box(media), image: box(mark), fit: markStyle.objectFit,
      position: markStyle.objectPosition, crop: markStyle.objectViewBox, transform: markStyle.transform,
      title: { ...line(h1), size: getComputedStyle(h1).fontSize, weight: getComputedStyle(h1).fontWeight },
      description: { ...line(p), size: getComputedStyle(p).fontSize, weight: getComputedStyle(p).fontWeight,
        leading: getComputedStyle(p).lineHeight, family: getComputedStyle(p).fontFamily },
      fontsLoaded: faces.every(face => face.length > 0),
      loaded: mark.complete && mark.naturalWidth > 0,
    };
  }, { item, lang, image, portrait });
}

async function main() {
  const config = JSON.parse(await readFile(path.join(__dirname, 'banners.json'), 'utf8'));
  const template = await readFile(path.join(__dirname, 'banner.html'), 'utf8');
  const portrait = dataURL('image/webp', await readFile(path.join(assets, 'portrait-sea.webp')));
  assert.equal(config.banners.length, 4);
  assert.equal(new Set(config.banners.map(banner => banner.id)).size, 4);
  const requested = process.argv[3];
  const all = requested === '--all';
  const banners = !requested || all ? config.banners : config.banners.filter(banner => banner.id === requested);
  assert.ok(banners.length, `Unknown banner: ${requested}`);
  const languages = all ? [config.lang, ...Object.keys(config.translations)] : [config.lang];
  if (all) assert.equal(languages.length, 11);
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.OG_CHROMIUM ? undefined : 'chrome',
    executablePath: process.env.OG_CHROMIUM || undefined,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.setContent(template);
    await page.addStyleTag({ content: await embedFonts() });
    const images = { portrait };
    if (banners.some(banner => banner.image === 't-capital')) {
      images['t-capital'] = await transparentMark(page, 't-capital.svg', ['#FFFFFF', '#101315']);
    }
    if (banners.some(banner => banner.image === 'fmb')) {
      images.fmb = await transparentMark(page, 'fast-money-bot.svg', ['#FFFFFF', 'url(#navy)']);
    }
    const jobs = languages.flatMap(lang => banners.map(banner => ({ lang, banner })));
    for (const { lang, banner } of jobs) {
      const description = lang === config.lang ? banner.description : config.translations[lang][banner.id];
      assert.ok(description, `${lang}/${banner.id}: missing description`);
      const check = await render(page, { ...banner, description }, lang, images[banner.image], portrait);
      assert.deepEqual(check.panel, [55, 70, 1090, 490]);
      const isPortrait = banner.image === 'portrait';
      const portraitLift = isPortrait ? 40 : 0;
      assert.deepEqual(check.media, [836, 191 - portraitLift, 248, 248]);
      assert.deepEqual(check.image, [840, 195 - portraitLift, 240, 240]);
      assert.equal(check.fit, isPortrait ? 'cover' : 'contain');
      assert.equal(check.position, '50% 50%');
      assert.equal(check.crop, isPortrait ? 'inset(2% 15.5% 29%)' : 'none');
      assert.equal(check.transform, 'none');
      assert.ok(check.fontsLoaded && check.loaded, banner.id);
      const [x, y, width, height] = check.copy;
      const [ix, iy, iw, ih] = check.image;
      assert.ok(y >= 130 && y + height <= 500);
      assert.ok(Math.abs(y + height / 2 - 315) < 0.1, `${banner.id}: text group is off center`);
      assert.equal(check.title.size, '86px');
      assert.equal(check.title.weight, '700');
      assert.equal(check.description.size, '44px');
      assert.equal(check.description.weight, '500');
      assert.equal(check.description.leading, '50.6px');
      const family = { th: 'Noto Sans Thai', hi: 'Noto Sans Devanagari' }[lang] || 'Inter';
      assert.ok(check.description.family.startsWith(family) || check.description.family.startsWith(`"${family}"`));
      assert.equal(check.title.lines, 1, `${banner.id}: unexpected title wrap`);
      const allowedLines = lang === 'ru' && ['home', 't-capital'].includes(banner.id) ? 1 : 2;
      assert.ok(check.description.lines >= 1 && check.description.lines <= allowedLines, `${lang}/${banner.id}: unexpected description wrap`);
      if (lang === 'ru' && banner.id === 'fast-money-bot') assert.equal(check.description.lines, 2);
      assert.ok(Math.abs(check.title.left - check.description.left) < 1, `${banner.id}: inconsistent left edge`);
      const minimumGap = banner.id === 'fast-money-bot' ? 30 : 8;
      for (const text of [check.title, check.description]) {
        assert.ok(text.right <= x + width, `${banner.id}: text overflow`);
        const gap = Math.max(ix - text.right, text.left - (ix + iw), iy - text.bottom, text.top - (iy + ih));
        assert.ok(gap >= minimumGap, `${banner.id}: text too close to the image (${gap.toFixed(1)} px)`);
      }
      const directory = all ? path.join(output, lang) : output;
      await mkdir(directory, { recursive: true });
      const filename = all ? `${banner.file}-v3.jpg` : `${banner.id}.jpg`;
      const jpeg = await page.screenshot({ path: path.join(directory, filename), type: 'jpeg', quality: 95 });
      const large = await sharp(jpeg).metadata();
      assert.deepEqual([large.width, large.height], [1200, 630]);
      if (!all) {
        const small = await sharp(jpeg).resize({ width: 500 }).jpeg({ quality: 93 }).toFile(path.join(output, `${banner.id}-500.jpg`));
        assert.deepEqual([small.width, small.height], [500, 263]);
      }
    }
    console.log(`Verified ${jobs.length} JPEGs, 1200×630, ${languages.length} language(s).`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
