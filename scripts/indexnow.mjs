/**
 * IndexNow 핑. 새로 바뀐 글 주소를 검색엔진에 알린다.
 *
 * IndexNow는 Google이 아니라 **Bing · Yandex · Naver · Seznam · Yep** 이 함께 쓰는 개방 프로토콜이다.
 * Naver가 참여하므로(2023-07) 한국 검색에서 의미가 있다. 무료이고 심사가 없다.
 *
 * 전제: 키 파일이 사이트 루트에 공개되어 있어야 한다. `public/<키>.txt` 로 두면
 *       https://<도메인>/<키>.txt 로 서비스된다. 그래서 별도 secret이 필요 없다(키는 공개 값).
 *
 * 사용:
 *   node scripts/indexnow.mjs --changed     # 마지막 커밋에서 바뀐 글 주소만
 *   node scripts/indexnow.mjs <url> [...]   # 지정한 주소
 *   node scripts/indexnow.mjs --all         # sitemap의 모든 주소
 */

import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SITE_URL = process.env.SITE_URL || 'https://blog.silgum.co.kr';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const PUBLIC_DIR = 'public';
const CONTENT_DIR = 'src/content/blog';

function git(args) {
	return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).trim();
}

/** public/ 아래의 32자리 hex 키 파일을 찾는다. 없으면 null. */
async function findKey() {
	const entries = await readdir(PUBLIC_DIR).catch(() => []);
	for (const name of entries) {
		const match = name.match(/^([0-9a-f]{32})\.txt$/);
		if (!match) continue;
		const body = (await readFile(join(PUBLIC_DIR, name), 'utf8')).trim();
		if (body === match[1]) return match[1];
	}
	return null;
}

function slugToUrl(file) {
	const slug = file.replace(/^.*\//, '').replace(/\.mdx?$/, '');
	return SITE_URL + '/blog/' + slug + '/';
}

async function changedUrls() {
	const output = git(['diff', '--name-only', 'HEAD^', 'HEAD', '--', CONTENT_DIR]);
	const files = output.split(/\r?\n/).filter((line) => line.endsWith('.md') || line.endsWith('.mdx'));
	return [...new Set(files.map(slugToUrl))];
}

async function allUrls() {
	const response = await fetch(SITE_URL + '/sitemap-0.xml');
	if (!response.ok) throw new Error('sitemap을 읽지 못했습니다: ' + response.status);
	const xml = await response.text();
	return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

async function main() {
	const args = process.argv.slice(2);
	const key = await findKey();
	if (!key) {
		console.log('IndexNow 키 파일(public/<32자리 hex>.txt)이 없어 건너뜁니다.');
		return;
	}
	const keyLocation = SITE_URL + '/' + key + '.txt';

	// 키 파일이 실제로 서비스되지 않으면 소유권 확인이 실패한다. 먼저 확인하고 조용히 건너뛴다.
	const keyCheck = await fetch(keyLocation).catch(() => null);
	if (!keyCheck || !keyCheck.ok || (await keyCheck.text()).trim() !== key) {
		console.log('IndexNow 키 파일이 아직 서비스되지 않습니다(' + keyLocation + '). 도메인 연결 후 자동으로 동작합니다.');
		return;
	}

	let urls;
	if (args.includes('--all')) urls = await allUrls();
	else if (args.includes('--changed')) urls = await changedUrls();
	else urls = args.filter((item) => !item.startsWith('--'));
	if (urls.length === 0) {
		console.log('IndexNow에 알릴 주소가 없습니다.');
		return;
	}

	const response = await fetch(ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
		body: JSON.stringify({ host: new URL(SITE_URL).host, key, keyLocation, urlList: urls }),
	});
	console.log('IndexNow ' + response.status + ' — ' + urls.length + '개 주소');
	for (const url of urls) console.log('  ' + url);
	if (!response.ok) console.log('응답: ' + (await response.text()).slice(0, 300));
}

main().catch((error) => {
	// 알림 실패로 배포를 막지 않는다.
	console.log('IndexNow 건너뜀: ' + (error instanceof Error ? error.message : String(error)));
});
