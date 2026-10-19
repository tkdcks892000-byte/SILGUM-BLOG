/**
 * 카드 SVG를 PNG로 렌더링한다. **빌드 직전에 실행**된다.
 *
 * 왜 저장소에 PNG를 두지 않는가: 이 PC의 DRM이 디스크의 PNG를 나중에 암호화해 버린다.
 * 그러면 커밋된 PNG가 "DRMONE …" blob이 되고 Astro 빌드가 깨진다(2026-10-19에 실제로 발생).
 * 그래서 SVG(텍스트)만 저장소에 두고, PNG는 빌드할 때마다 새로 만든다. CI에는 DRM이 없다.
 *
 * 사용: node scripts/render-cards.mjs
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const PNG_SIGNATURE = '89504e470d0a1a0a';
const CARD_DIR = join('src', 'assets', 'cards');
const EXTRA = [join('public', 'og-default.svg')];

function isPng(bytes) {
	return bytes.length > 8 && bytes.subarray(0, 8).toString('hex') === PNG_SIGNATURE;
}

async function render(svgPath) {
	const svg = await readFile(svgPath);
	const pngPath = svgPath.replace(/\.svg$/, '.png');
	await sharp(svg).png().toFile(pngPath);
	const written = await readFile(pngPath);
	if (!isPng(written)) throw new Error('PNG로 렌더링되지 않았습니다: ' + pngPath);
	return pngPath;
}

const svgPaths = [];
for (const name of await readdir(CARD_DIR).catch(() => [])) {
	if (name.endsWith('.svg')) svgPaths.push(join(CARD_DIR, name));
}
for (const path of EXTRA) {
	try {
		await readFile(path);
		svgPaths.push(path);
	} catch {
		// 없으면 건너뛴다.
	}
}

if (svgPaths.length === 0) {
	console.log('렌더링할 카드 SVG가 없습니다.');
	process.exit(0);
}

let count = 0;
for (const path of svgPaths) {
	await render(path);
	count += 1;
}
console.log('카드 PNG ' + count + '개를 렌더링했습니다.');
