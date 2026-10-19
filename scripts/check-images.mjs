/**
 * 이미지 파일이 실제 PNG인지 검사한다.
 *
 * 이 PC의 DRM(Fasoo 계열)이 디스크의 PNG를 나중에 암호화하는 일이 있다. 그러면 첫 바이트가
 * "DRMONE …"이 되고, 커밋되면 Astro 빌드가 "Could not process image metadata"로 죽는다.
 * 커밋·배포 전에 여기서 먼저 잡는다.
 *
 * 사용: node scripts/check-images.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PNG_SIGNATURE = '89504e470d0a1a0a';
const ROOTS = ['public', 'src/assets'];

async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
	const files = [];
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await walk(path)));
		else if (entry.name.toLowerCase().endsWith('.png')) files.push(path);
	}
	return files;
}

function describeHead(bytes) {
	return bytes.subarray(0, 16).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
}

const problems = [];
let checked = 0;
for (const root of ROOTS) {
	for (const file of await walk(root)) {
		const bytes = await readFile(file);
		checked += 1;
		if (bytes.length < 8 || bytes.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) {
			problems.push(file + ' — PNG 시그니처가 없습니다. 앞부분: "' + describeHead(bytes) + '"');
		}
	}
}

if (problems.length > 0) {
	console.error('이미지 검사 실패 (' + checked + '개 중 ' + problems.length + '개):');
	for (const problem of problems) console.error('  ' + problem);
	console.error('');
	console.error('이 PC의 DRM이 파일을 암호화했을 수 있습니다. 다시 생성하거나 `git restore <파일>` 하세요.');
	process.exit(1);
}
console.log('이미지 검사 통과: PNG ' + checked + '개');
