/**
 * public/screens/*.webp 를 운영 사이트(silgum.co.kr)의 지금 화면으로 다시 찍는다.
 *
 * GitHub Actions(.github/workflows/capture-screens.yml)에서만 돈다. 운영자 PC는 보안 프로그램이
 * 새로 만든 그림 파일을 암호화하므로(2026-11-02 확인) 여기서 찍지 않는다.
 * 방문 집계에서 빠지도록 SILGUM의 방문 제외 쿠키(silgum_visit_optout=1)를 붙인다.
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const SITE = process.env.SILGUM_URL || 'https://silgum.co.kr';
const OUT = join('public', 'screens');

const SHOTS = [
	{ file: 'home-1920.webp', path: '/', width: 1920, height: 1080 },
	{ file: 'trend-detail-1920.webp', path: '/', width: 1920, height: 1080, clip: 'section.lt' },
	{ file: 'service-menu-1920.webp', path: '/', width: 1920, height: 1080, before: (page) => page.click('.engine-selector') },
	{ file: 'search-tools-1920.webp', path: '/tools', width: 1920, height: 1080 },
	{ file: 'panel-430.webp', path: '/panel', width: 430, height: 900 },
];

async function main() {
	await mkdir(OUT, { recursive: true });
	const browser = await chromium.launch();
	try {
		for (const shot of SHOTS) {
			const context = await browser.newContext({ viewport: { width: shot.width, height: shot.height }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
			await context.addCookies([{ name: 'silgum_visit_optout', value: '1', url: SITE }]);
			const page = await context.newPage();
			await page.goto(SITE + shot.path, { waitUntil: 'networkidle' });
			// 실시간 트렌드가 채워질 때까지(홈·패널). 없으면 그대로 찍는다.
			await page.waitForSelector('.lt-row .lt-kw, .panel-ranking button', { timeout: 15000 }).catch(() => {});
			await page.waitForTimeout(1500);
			if (shot.before) {
				await shot.before(page);
				await page.waitForTimeout(500);
			}
			const png = shot.clip ? await page.locator(shot.clip).first().screenshot() : await page.screenshot();
			await sharp(png).webp({ quality: 82 }).toFile(join(OUT, shot.file));
			console.log('찍음: ' + shot.file);
			await context.close();
		}
	} finally {
		await browser.close();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
