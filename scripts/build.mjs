// Build: pre-renders LaTeX to inline SVG (MathJax) and expands [[EN||ID]] pairs.
// Output: dist/index.html + dist/styles.css + dist/main.js + dist/assets/*
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: 'none' }),
});

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

let count = 0;
function renderTex(html) {
  return html.replace(/<(span|div) class="tex([^"]*)" data-tex="([^"]*)"(\s+data-display)?\s*><\/\1>/g,
    (_, tag, extra, tex, disp) => {
      const node = doc.convert(decode(tex), { display: !!disp });
      let svg = adaptor.outerHTML(node);
      count++;
      return `<${tag} class="tex${extra}" role="math" aria-label="${tex.replace(/"/g, '&quot;')}">${svg}</${tag}>`;
    });
}

function expandPairs(html) {
  return html.replace(/\[\[([\s\S]*?)\|\|([\s\S]*?)\]\]/g, '<span class="en">$1</span><span class="id" lang="id">$2</span>');
}

const CAR_CTL = '<div class="car-ctl"><span class="car-count"></span><div class="car-cap" aria-live="polite"></div><div class="car-prog"><i></i></div><div class="car-btns"><button type="button" class="car-prev" aria-label="Previous image"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg></button><button type="button" class="car-next" aria-label="Next image"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button></div></div>';
let body = expandPairs(renderTex(src('index.html'))).replace(/<!--CAR-CTL-->/g, CAR_CTL);
const css = src('styles.css');
const js = src('main.js');

const HEAD = `<title>Mohammad Dimas Afradika</title>
<meta name="description" content="Mohammad Dimas Afradika: Computer Science and Mathematics at BINUS University. Machine learning, NLP, spatial data science and optimization.">
<meta property="og:title" content="Mohammad Dimas Afradika">
<meta property="og:description" content="Machine learning and spatial data science, with the math to back it.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&family=Inter:wght@400;500;600;700&display=swap">`;

const dist = join(root, 'dist');
if (existsSync(dist)) rmSync(dist, { recursive: true });
mkdirSync(join(dist, 'assets'), { recursive: true });
for (const f of readdirSync(join(root, 'public', 'assets'))) copyFileSync(join(root, 'public', 'assets', f), join(dist, 'assets', f));

writeFileSync(join(dist, 'styles.css'), css);
writeFileSync(join(dist, 'main.js'), js);
writeFileSync(join(dist, 'index.html'),
`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${HEAD}
<link rel="stylesheet" href="styles.css">
</head>
<body>
${body}
<script src="main.js"></script>
</body>
</html>
`);

// Single-file fragment used for the hosted preview (no doctype/head, inline CSS + JS).
mkdirSync(join(root, 'preview'), { recursive: true });
writeFileSync(join(root, 'preview', 'page.html'), `${HEAD}\n<style>${css}</style>\n${body}\n<script>${js}</script>\n`);

console.log(`Built dist/ with ${count} equations.`);
