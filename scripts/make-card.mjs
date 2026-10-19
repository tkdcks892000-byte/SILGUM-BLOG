/**
 * 블로그 글의 대표 이미지(1200x630)를 만든다.
 *
 * 실검(SILGUM) 마크와 지원 검색 서비스 로고 줄, 글 제목을 넣은 카드를 만들어
 * src/assets/cards/에 저장한다. 만들어진 파일은 글 frontmatter의 heroImage로 참조하고,
 * 그대로 OG 이미지가 된다.
 *
 * 사용:
 *   npm run card -- --slug silgum-introduction --title "실검(SILGUM) 소개" --description "..."
 *   npm run card -- --slug silgum-introduction --square --title "..." --description "..."
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;
const SQUARE = 1080;
const INK = '#e8eefc';
const MUTED = '#9fb3d1';
const SOFT = '#7d93b3';
const ACCENT = '#16745f';
const TITLE_FONT = 'Malgun Gothic, Noto Sans KR, Segoe UI, sans-serif';
const ICON_DIR = join('assets', 'brand', 'services');
const SERVICE_ICONS = ['google', 'naver', 'bing', 'daum', 'yahoo', 'namuwiki', 'zum', 'nate'];

/** 실검 마크(public/favicon.svg와 같은 도형). */
function mark(x, y, size) {
	const scale = size / 64;
	return `<g transform="translate(${x} ${y}) scale(${scale})">
    <rect width="64" height="64" rx="18" fill="${ACCENT}"/>
    <path d="M45 20c-3-3-7-5-13-5-9 0-15 5-15 12 0 6 4 9 13 11 6 1 8 2 8 4 0 2-2 3-6 3-5 0-9-2-12-5l-5 7c4 4 10 6 17 6 10 0 16-5 16-12 0-6-4-10-13-12-6-1-8-2-8-4 0-2 2-3 5-3 4 0 7 1 10 4z" fill="#fff"/>
  </g>`;
}

function escapeXml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** 서비스 로고를 data URI로 읽는다. 카드마다 파일을 읽으면 느리므로 한 번만. */
async function loadServiceIcons() {
	const icons = [];
	for (const name of SERVICE_ICONS) {
		const svg = await readFile(join(ICON_DIR, name + '.svg'));
		icons.push('data:image/svg+xml;base64,' + svg.toString('base64'));
	}
	return icons;
}

/** 한글은 글자 폭이 fontSize, 라틴 문자는 그 절반 정도로 본다. */
function textWidth(text, fontSize) {
	let width = 0;
	for (const char of text) {
		width += /[\u1100-\u11FF\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF]/.test(char) ? fontSize : fontSize * 0.56;
	}
	return width;
}

function wrap(text, maxWidth, fontSize) {
	const lines = [];
	let line = '';
	for (const word of String(text).split(/\s+/).filter(Boolean)) {
		const candidate = line ? line + ' ' + word : word;
		if (line && textWidth(candidate, fontSize) > maxWidth) {
			lines.push(line);
			line = word;
		} else {
			line = candidate;
		}
	}
	if (line) lines.push(line);
	return lines;
}

/** 서비스 로고 8개를 가로로 늘어놓은 줄. 실검 카드에서 가장 눈에 띄는 요소다. */
function iconRow(icons, centerX, centerY, diameter = 68, gap = 20, iconSize = 36) {
	const total = icons.length * diameter + (icons.length - 1) * gap;
	const startX = centerX - total / 2;
	return icons
		.map((href, index) => {
			const cx = startX + index * (diameter + gap) + diameter / 2;
			return `<circle cx="${cx}" cy="${centerY}" r="${diameter / 2}" fill="#131f36" stroke="#223350" stroke-width="2"/>
  <image href="${href}" x="${cx - iconSize / 2}" y="${centerY - iconSize / 2}" width="${iconSize}" height="${iconSize}"/>`;
		})
		.join('\n  ');
}

const GLOW = `<defs>
    <radialGradient id="glow" cx="50%" cy="16%" r="85%">
      <stop offset="0%" stop-color="#16314f"/>
      <stop offset="58%" stop-color="#0d1930"/>
      <stop offset="100%" stop-color="#0b1220"/>
    </radialGradient>
  </defs>`;

function buildSvg({ title, description, icons }) {
	// 제목은 최대 3줄, 설명·로고 줄을 침범하지 않아야 한다.
	const TOP = 172;
	const BOTTOM = 388;
	let size = 56;
	let lines = [];
	for (; size >= 30; size -= 2) {
		lines = wrap(title, WIDTH - 160, size);
		if (lines.length <= 3 && TOP + lines.length * Math.round(size * 1.28) <= BOTTOM) break;
	}
	const lineHeight = Math.round(size * 1.28);
	const titleSvg = lines
		.map((line, index) => `<text x="80" y="${TOP + index * lineHeight}" font-family="${TITLE_FONT}" font-size="${size}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`)
		.join('\n  ');
	const descLine = description ? wrap(description, WIDTH - 200, 24)[0] || '' : '';

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${GLOW}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  ${mark(80, 60, 56)}
  <text x="152" y="100" font-family="${TITLE_FONT}" font-size="30" font-weight="700" fill="${INK}">실검</text>
  <text x="152" y="100" dx="66" font-family="${TITLE_FONT}" font-size="30" font-weight="700" fill="${SOFT}">SILGUM</text>
  <text x="${WIDTH - 80}" y="100" text-anchor="end" font-family="${TITLE_FONT}" font-size="22" fill="${SOFT}">silgum.co.kr</text>
  ${titleSvg}
  ${descLine ? `<text x="80" y="${TOP + lines.length * lineHeight + 22}" font-family="${TITLE_FONT}" font-size="24" fill="${MUTED}">${escapeXml(descLine)}</text>` : ''}
  ${iconRow(icons, WIDTH / 2, 524)}
</svg>`;
}

/**
 * 정사각형 카드. 티스토리 대표 이미지처럼 목록에서 잘려 보이는 자리에 쓴다.
 * 중요한 요소(마크·제목)를 가운데에 두어 어느 비율로 잘려도 남는다.
 */
function buildSquareSvg({ title, description, icons }) {
	const inner = SQUARE - 180;
	let size = 68;
	let lines = [];
	for (; size >= 32; size -= 2) {
		lines = wrap(title, inner, size);
		if (lines.length <= 4) break;
	}
	const lineHeight = Math.round(size * 1.3);
	const block = lines.length * lineHeight;
	const titleTop = Math.round((SQUARE - block) / 2) + size - 40;
	const titleSvg = lines
		.map((line, index) => `<text x="${SQUARE / 2}" y="${titleTop + index * lineHeight}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="${size}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`)
		.join('\n  ');
	const descLine = description ? wrap(description, inner, 26)[0] || '' : '';

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${SQUARE}" height="${SQUARE}" viewBox="0 0 ${SQUARE} ${SQUARE}">
  ${GLOW}
  <rect width="${SQUARE}" height="${SQUARE}" fill="url(#glow)"/>
  ${mark(SQUARE / 2 - 92, 88, 72)}
  <text x="${SQUARE / 2 + 4}" y="136" font-family="${TITLE_FONT}" font-size="40" font-weight="700" fill="${INK}">실검</text>
  <text x="${SQUARE / 2 + 4}" y="136" dx="90" font-family="${TITLE_FONT}" font-size="40" font-weight="700" fill="${SOFT}">SILGUM</text>
  ${titleSvg}
  ${descLine ? `<text x="${SQUARE / 2}" y="${titleTop + block + 58}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="26" fill="${MUTED}">${escapeXml(descLine)}</text>` : ''}
  ${iconRow(icons, SQUARE / 2, SQUARE - 176, 62, 16, 32)}
  <text x="${SQUARE / 2}" y="${SQUARE - 56}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="22" fill="${SOFT}">silgum.co.kr</text>
</svg>`;
}

function parseArgs(argv) {
	const args = {};
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith('--')) continue;
		const key = token.slice(2);
		const next = argv[index + 1];
		if (next === undefined || next.startsWith('--')) {
			args[key] = true;
			continue;
		}
		args[key] = next;
		index += 1;
	}
	return args;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const title = args.title;
	const description = args.description || '';
	const slug = args.slug;
	const square = Boolean(args.square) || args.shape === 'square';
	if (!title || !slug) throw new Error('--title 과 --slug 가 필요합니다.');
	const outPath = resolve(args.out || join('src', 'assets', 'cards', slug + (square ? '-square' : '') + '.png'));
	const icons = await loadServiceIcons();
	const svg = square ? buildSquareSvg({ title, description, icons }) : buildSvg({ title, description, icons });
	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath.replace(/\.png$/, '.svg'), svg, 'utf8');

	// 이 PC의 DRM이 쓰는 순간 파일을 암호화하는 일이 있다. 실제 PNG인지 확인하고, 아니면 다시 쓴다.
	let written = false;
	for (let attempt = 1; attempt <= 3 && !written; attempt += 1) {
		await sharp(Buffer.from(svg)).png().toFile(outPath);
		const bytes = await readFile(outPath);
		if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
			written = true;
			break;
		}
		console.error('경고: ' + attempt + '번째 생성 결과가 PNG가 아닙니다(DRM 의심). 다시 씁니다.');
		await new Promise((resolveWait) => setTimeout(resolveWait, 300));
	}
	if (!written) throw new Error('PNG로 저장되지 않았습니다. 이 PC의 DRM이 파일을 암호화하고 있을 수 있습니다: ' + outPath);

	console.log((square ? '정사각형 대표 이미지: ' : '대표 이미지: ') + outPath);
	if (!args.out) console.log('frontmatter: heroImage: "../../assets/cards/' + slug + (square ? '-square' : '') + '.png"');
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
