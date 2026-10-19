/**
 * 블로그 대표 이미지(1200x630) 생성기 — 사이트의 실제 로고/폰트 기준.
 *
 * 사이트(app/globals.css)에서 확인한 값:
 *  - 로고: "SILGUM" 워드마크. 흰색→#dbe8ff→#a9c8ff 세로 그라데이션, 자간 -2.5px(@60px),
 *          아래에 파란 그라데이션 밑줄 바(#6ea8fe → #a9c8ff)와 은은한 빛.
 *  - 강조색: #6ea8fe (초록 아님).
 *  - 폰트: Pretendard → Noto Sans KR → ... 순. 이 PC에는 Pretendard가 없어 Noto Sans KR로 렌더된다.
 *
 * 사용:
 *   npm run card -- --slug foo --title "..." --description "..." [--layout left|center] [--square]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;
const SQUARE = 1080;
const INK = '#e8eefc';
const MUTED = '#9fb3d1';
const FAINT = '#7d93b3';
const ACCENT = '#6ea8fe';
const FONT = 'Noto Sans KR, Pretendard, Malgun Gothic, sans-serif';
const ICON_DIR = join('assets', 'brand', 'services');
const SERVICE_ICONS = ['google', 'naver', 'bing', 'daum', 'yahoo', 'namuwiki', 'zum', 'nate'];

const DEFS = `<defs>
    <linearGradient id="word" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#dbe8ff"/>
      <stop offset="100%" stop-color="#a9c8ff"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6ea8fe"/>
      <stop offset="100%" stop-color="#a9c8ff"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="14%" r="78%">
      <stop offset="0%" stop-color="#122a4a"/>
      <stop offset="55%" stop-color="#0c1526"/>
      <stop offset="100%" stop-color="#0b1220"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
  </defs>`;

function escapeXml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

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

// "검색 허브"처럼 붙어 있어야 자연스러운 말은 줄바꿈으로 쪼개지 않게 묶는다.
const KEEP_TOGETHER = ['검색 허브', '검색 서비스', '실시간 트렌드', '실시간 검색어'];

function protectPhrases(text) {
	let out = String(text);
	for (const phrase of KEEP_TOGETHER) out = out.split(phrase).join(phrase.replace(/ /g, '\u00A0'));
	return out;
}

/** 공백에서만 끊는다(한국어 단어 중간에서 끊지 않는다). 묶은 말은 NBSP라 끊기지 않는다. */
function wrap(text, maxWidth, fontSize) {
	const lines = [];
	let line = '';
	for (const word of protectPhrases(text).split(' ').filter(Boolean)) {
		const candidate = line ? line + ' ' + word : word;
		if (line && textWidth(candidate, fontSize) > maxWidth) {
			lines.push(line);
			line = word;
		} else {
			line = candidate;
		}
	}
	if (line) lines.push(line);
	return lines.map((item) => item.replace(/\u00A0/g, ' '));
}

/**
 * 줄 길이를 고르게 만든다(사이트의 text-wrap: balance와 같은 목적).
 * - 한 줄에 들어가면 그대로 둔다.
 * - maxLines 이하로 자연스럽게 끊기고 줄 길이가 고르면 그대로 둔다.
 * - 그렇지 않으면, 같은 줄 수를 유지하는 가장 좁은 폭을 찾아 고르게 나눈다.
 */
function balancedWrap(text, maxWidth, fontSize, maxLines) {
	const natural = wrap(text, maxWidth, fontSize);
	if (natural.length <= 1) return natural;
	if (natural.length > maxLines) {
		let low = 1;
		let high = maxWidth;
		let best = null;
		for (let step = 0; step < 24; step += 1) {
			const mid = (low + high) / 2;
			const lines = wrap(text, mid, fontSize);
			if (lines.length <= maxLines) {
				best = lines;
				high = mid;
			} else {
				low = mid;
			}
		}
		return best || natural.slice(0, maxLines);
	}
	const widths = natural.map((line) => textWidth(line, fontSize));
	const shortest = Math.min(...widths);
	const longest = Math.max(...widths);
	if (shortest / longest > 0.6) return natural;

	let low = 1;
	let high = maxWidth;
	let best = natural;
	for (let step = 0; step < 24; step += 1) {
		const mid = (low + high) / 2;
		const lines = wrap(text, mid, fontSize);
		if (lines.length <= natural.length) {
			best = lines;
			high = mid;
		} else {
			low = mid;
		}
	}
	return best;
}

/** 사이트 로고와 같은 워드마크: 그라데이션 글자 + 파란 밑줄 바 + 은은한 빛. */
function wordmark(x, baseline, size, { center = false, width } = {}) {
	const spacing = -(size * 0.042);
	const approxWidth = width || textWidth('SILGUM', size) + spacing * 5;
	const barX = center ? x - approxWidth / 2 : x;
	return `<text x="${x}" y="${baseline}" text-anchor="${center ? 'middle' : 'start'}" font-family="${FONT}" font-size="${size}" font-weight="700" letter-spacing="${spacing}" fill="url(#word)">SILGUM</text>
  <g opacity="0.5" filter="url(#soft)"><rect x="${barX + 2}" y="${baseline + 12}" width="${(approxWidth - 4).toFixed(1)}" height="${Math.max(2, size * 0.045).toFixed(1)}" rx="2" fill="url(#bar)"/></g>
  <rect x="${barX + 2}" y="${baseline + 12}" width="${(approxWidth - 4).toFixed(1)}" height="${Math.max(2, size * 0.045).toFixed(1)}" rx="2" fill="url(#bar)"/>`;
}

function iconRow(icons, x, centerY, diameter = 44, gap = 14, iconSize = 24, align = 'center') {
	const total = icons.length * diameter + (icons.length - 1) * gap;
	const startX = align === 'start' ? x : x - total / 2;
	return icons
		.map((href, index) => {
			const cx = startX + index * (diameter + gap) + diameter / 2;
			return `<circle cx="${cx}" cy="${centerY}" r="${diameter / 2}" fill="#111d33" stroke="#1e2c47" stroke-width="1.5"/>
  <image href="${href}" x="${cx - iconSize / 2}" y="${centerY - iconSize / 2}" width="${iconSize}" height="${iconSize}"/>`;
		})
		.join('\n  ');
}

function layoutLeft({ title, description, icons }) {
	const M = 88;
	const titleSize = 54;
	const lines = balancedWrap(title, WIDTH - M * 2, titleSize, 2);
	const titleTop = 286;
	const lineHeight = Math.round(titleSize * 1.36);
	const titleSvg = lines
		.map((line, index) => `<text x="${M}" y="${titleTop + index * lineHeight}" font-family="${FONT}" font-size="${titleSize}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`)
		.join('\n  ');
	const descLine = description ? balancedWrap(description, WIDTH - M * 2, 24, 1)[0] || '' : '';

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${DEFS}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  ${wordmark(M, 148, 66)}
  <text x="${M}" y="228" font-family="${FONT}" font-size="24" fill="${MUTED}">검색 서비스를 골라 검색하는 검색 허브</text>
  ${titleSvg}
  ${descLine ? `<text x="${M}" y="${titleTop + lines.length * lineHeight + 26}" font-family="${FONT}" font-size="24" fill="${MUTED}">${escapeXml(descLine)}</text>` : ''}
  ${iconRow(icons, M, 556, 42, 12, 22, 'start')}
  <text x="${WIDTH - M}" y="562" text-anchor="end" font-family="${FONT}" font-size="20" fill="${FAINT}">silgum.co.kr</text>
</svg>`;
}

function layoutCenter({ title, description, icons }) {
	// 양옆을 넓게 쓴다. 가운데 정렬이되 줄이 짧아지지 않도록 최대 폭을 크게 잡는다.
	const MAX = WIDTH - 160;
	let titleSize = 58;
	let lines = wrap(title, MAX, titleSize);
	while (lines.length > 2 && titleSize > 40) {
		titleSize -= 4;
		lines = wrap(title, MAX, titleSize);
	}
	const lineHeight = Math.round(titleSize * 1.32);
	const titleTop = 300;
	const titleSvg = lines
		.map((line, index) => `<text x="${WIDTH / 2}" y="${titleTop + index * lineHeight}" text-anchor="middle" font-family="${FONT}" font-size="${titleSize}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`)
		.join('\n  ');
	const descLine = description ? wrap(description, MAX, 23)[0] || '' : '';

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${DEFS}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  ${wordmark(WIDTH / 2, 176, 60, { center: true })}
  ${titleSvg}
  ${descLine ? `<text x="${WIDTH / 2}" y="${titleTop + lines.length * lineHeight + 24}" text-anchor="middle" font-family="${FONT}" font-size="23" fill="${MUTED}">${escapeXml(descLine)}</text>` : ''}
  ${iconRow(icons, WIDTH / 2, 556, 40, 12, 20)}
</svg>`;
}

function layoutSquare({ title, description, icons }) {
	const inner = SQUARE - 160;
	let titleSize = 62;
	let lines = wrap(title, inner, titleSize);
	while (lines.length > 3 && titleSize > 40) {
		titleSize -= 4;
		lines = wrap(title, inner, titleSize);
	}
	const lineHeight = Math.round(titleSize * 1.32);
	const block = lines.length * lineHeight;
	const titleTop = Math.round((SQUARE - block) / 2) + titleSize - 24;
	const titleSvg = lines
		.map((line, index) => `<text x="${SQUARE / 2}" y="${titleTop + index * lineHeight}" text-anchor="middle" font-family="${FONT}" font-size="${titleSize}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`)
		.join('\n  ');
	const descLine = description ? wrap(description, inner, 24)[0] || '' : '';

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${SQUARE}" height="${SQUARE}" viewBox="0 0 ${SQUARE} ${SQUARE}">
  ${DEFS}
  <rect width="${SQUARE}" height="${SQUARE}" fill="url(#glow)"/>
  ${wordmark(SQUARE / 2, 168, 58, { center: true })}
  <text x="${SQUARE / 2}" y="236" text-anchor="middle" font-family="${FONT}" font-size="23" fill="${MUTED}">검색 서비스를 골라 검색하는 검색 허브</text>
  ${titleSvg}
  ${descLine ? `<text x="${SQUARE / 2}" y="${titleTop + block + 52}" text-anchor="middle" font-family="${FONT}" font-size="24" fill="${MUTED}">${escapeXml(descLine)}</text>` : ''}
  ${iconRow(icons, SQUARE / 2, SQUARE - 170, 44, 12, 22)}
  <text x="${SQUARE / 2}" y="${SQUARE - 52}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${FAINT}">silgum.co.kr</text>
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
	const { title, slug } = args;
	const description = args.description || '';
	const square = Boolean(args.square) || args.shape === 'square';
	// 사이트 히어로와 같은 중앙 정렬이 기본. 왼쪽 정렬은 --layout left 로만.
	const layout = args.layout === 'left' ? 'left' : 'center';
	if (!title || !slug) throw new Error('--title 과 --slug 가 필요합니다.');

	const suffix = (square ? '-square' : '') + (layout === 'left' && !square ? '-left' : '');
	const outPath = resolve(args.out || join('src', 'assets', 'cards', slug + suffix + '.png'));
	const icons = await loadServiceIcons();
	const svg = square ? layoutSquare({ title, description, icons }) : layout === 'center' ? layoutCenter({ title, description, icons }) : layoutLeft({ title, description, icons });

	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath.replace(/\.png$/, '.svg'), svg, 'utf8');
	await sharp(Buffer.from(svg)).png().toFile(outPath);
	console.log('대표 이미지: ' + outPath);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
