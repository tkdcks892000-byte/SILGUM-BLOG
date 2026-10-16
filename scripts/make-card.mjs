/**
 * 블로그 글의 대표 이미지(1200x630)를 만든다.
 *
 * 실검(SILGUM) 마크와 글 제목을 넣은 카드를 생성해 src/assets/cards/에 저장한다.
 * 만들어진 파일은 글 frontmatter의 heroImage로 참조하고, 그대로 OG 이미지가 된다.
 *
 * 사용:
 *   npm run card -- --slug silgum-introduction --title "실검(SILGUM) 소개" --description "..."
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;
const SQUARE = 1080;
const INK = '#e8eefc';
const MUTED = '#9fb3d1';
const SOFT = '#6b82a6';
const ACCENT = '#16745f';
const TITLE_FONT = 'Malgun Gothic, Noto Sans KR, Segoe UI, sans-serif';

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

function layoutTitle(title) {
	// 제목은 최대 3줄, 그리고 설명·푸터를 침범하지 않아야 한다.
	const TITLE_TOP = 258;
	const TITLE_BOTTOM = 506;
	for (let size = 68; size >= 34; size -= 2) {
		const lines = wrap(title, WIDTH - 160, size);
		const lineHeight = Math.round(size * 1.28);
		if (lines.length <= 3 && TITLE_TOP + lines.length * lineHeight <= TITLE_BOTTOM) {
			return { size, lines, lineHeight, top: TITLE_TOP };
		}
	}
	return { size: 34, lines: wrap(title, WIDTH - 160, 34).slice(0, 3), lineHeight: 44, top: TITLE_TOP };
}

function buildSvg({ title, description }) {
	const { size, lines, lineHeight, top } = layoutTitle(title);
	const oneLine = description ? wrap(description, WIDTH - 160, 24)[0] || '' : '';

	const titleSvg = lines
		.map((line, index) => `<text x="80" y="${top + index * lineHeight}" font-family="${TITLE_FONT}" font-size="${size}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`)
		.join('\n  ');
	const descSvg = oneLine
		? `<text x="80" y="534" font-family="${TITLE_FONT}" font-size="24" fill="${MUTED}">${escapeXml(oneLine)}</text>`
		: '';

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="18%" r="80%">
      <stop offset="0%" stop-color="#16314f"/>
      <stop offset="60%" stop-color="#0d1930"/>
      <stop offset="100%" stop-color="#0b1220"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  ${mark(80, 76, 64)}
  <text x="164" y="120" font-family="${TITLE_FONT}" font-size="34" font-weight="700" fill="${INK}">실검</text>
  <text x="164" y="120" font-family="${TITLE_FONT}" font-size="34" font-weight="700" fill="${SOFT}" dx="76">SILGUM</text>
  <rect x="80" y="176" width="72" height="6" rx="3" fill="${ACCENT}"/>
  ${titleSvg}
  ${descSvg}
  <text x="80" y="${HEIGHT - 44}" font-family="${TITLE_FONT}" font-size="22" fill="${SOFT}">검색 서비스를 골라 검색하는 검색 허브 · silgum.co.kr</text>
</svg>`;
}

/**
 * 정사각형 카드. 티스토리 대표 이미지처럼 목록에서 잘려 보이는 자리에 쓴다.
 * 중요한 요소(마크·제목)를 가운데에 두어 어느 비율로 잘려도 남는다.
 */
function buildSquareSvg({ title, description }) {
	const inner = SQUARE - 160;
	let size = 76;
	let lines = [];
	for (; size >= 34; size -= 2) {
		lines = wrap(title, inner, size);
		if (lines.length <= 4) break;
	}
	const lineHeight = Math.round(size * 1.3);
	const block = lines.length * lineHeight;
	const titleTop = Math.round((SQUARE - block) / 2) + size;
	const titleSvg = lines
		.map((line, index) => `<text x="${SQUARE / 2}" y="${titleTop + index * lineHeight}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="${size}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`)
		.join('\n  ');
	const descLine = description ? wrap(description, inner, 26)[0] || '' : '';
	const descSvg = descLine
		? `<text x="${SQUARE / 2}" y="${titleTop + block + 64}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="26" fill="${MUTED}">${escapeXml(descLine)}</text>`
		: '';

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${SQUARE}" height="${SQUARE}" viewBox="0 0 ${SQUARE} ${SQUARE}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#16314f"/>
      <stop offset="60%" stop-color="#0d1930"/>
      <stop offset="100%" stop-color="#0b1220"/>
    </radialGradient>
  </defs>
  <rect width="${SQUARE}" height="${SQUARE}" fill="url(#glow)"/>
  ${mark(SQUARE / 2 - 92, 96, 76)}
  <text x="${SQUARE / 2 + 6}" y="146" font-family="${TITLE_FONT}" font-size="42" font-weight="700" fill="${INK}">실검</text>
  <text x="${SQUARE / 2 + 6}" y="146" font-family="${TITLE_FONT}" font-size="42" font-weight="700" fill="${SOFT}" dx="94">SILGUM</text>
  <rect x="${SQUARE / 2 - 42}" y="204" width="84" height="7" rx="3.5" fill="${ACCENT}"/>
  ${titleSvg}
  ${descSvg}
  <text x="${SQUARE / 2}" y="${SQUARE - 72}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="24" fill="${SOFT}">검색 서비스를 골라 검색하는 검색 허브 · silgum.co.kr</text>
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
	const defaultPath = join('src', 'assets', 'cards', slug + (square ? '-square' : '') + '.png');
	const outPath = resolve(args.out || defaultPath);
	const svg = square ? buildSquareSvg({ title, description }) : buildSvg({ title, description });
	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath.replace(/\.png$/, '.svg'), svg, 'utf8');
	await sharp(Buffer.from(svg)).png().toFile(outPath);
	console.log((square ? '정사각형 대표 이미지: ' : '대표 이미지: ') + outPath);
	if (!args.out) {
		console.log('frontmatter: heroImage: "../../assets/cards/' + slug + (square ? '-square' : '') + '.png"');
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
