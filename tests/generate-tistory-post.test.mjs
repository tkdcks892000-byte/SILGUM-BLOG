/**
 * 티스토리 홍보글 생성기 테스트. 네트워크·LLM을 부르지 않는다(fetch는 tests/fixtures/stub-fetch.mjs로 대체).
 * 실행: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	buildExcerpt,
	extractScreenshots,
	inlineHtml,
	parseMode,
	parseSource,
	toPasteHtml,
	toPasteText,
	validatePasteHtml,
	validatePost,
} from '../scripts/generate-tistory-post.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const SCRIPT = join(ROOT, 'scripts', 'generate-tistory-post.mjs');
const STUB = pathToFileURL(join(ROOT, 'tests', 'fixtures', 'stub-fetch.mjs')).href;
const PANEL_SOURCE = join(ROOT, 'src', 'content', 'blog', 'silgum-extension-panel-guide.md');
const IMG = 'https://blog.silgum.co.kr/screens/home-1920.webp';

const squash = (text) => text.replace(/\s+/g, ' ');

test('이미지 마크다운은 <img>가 되고, 캡션은 따로 <em> 문단이 된다', () => {
	const html = toPasteHtml({ summary: '요약', body: '![실검 첫 화면](' + IMG + ')\n*첫 화면 캡션입니다.*\n\n본문 문단.' });
	assert.match(html, /<p><img src="https:\/\/blog\.silgum\.co\.kr\/screens\/home-1920\.webp" alt="실검 첫 화면" loading="lazy"><\/p>/);
	assert.match(html, /<p><em>첫 화면 캡션입니다\.<\/em><\/p>/);
	assert.match(html, /<p>본문 문단\.<\/p>/);
	assert.ok(!html.includes('!'), '이미지 문법의 ! 가 남으면 안 된다');
	assert.ok(validatePasteHtml(html));
});

test('블로그 주소 밖의 이미지는 막는다', () => {
	assert.throws(() => inlineHtml('![x](https://evil.example.com/a.png)'), /허용되지 않은 이미지/);
	assert.throws(() => inlineHtml('![x](http://blog.silgum.co.kr/a.png)'), /허용되지 않은 이미지/);
	assert.throws(() => inlineHtml('![x](https://blog.silgum.co.kr.evil.com/a.png)'), /허용되지 않은 이미지/);
	assert.throws(() => validatePasteHtml('<p><img src="https://evil.example.com/a.png" alt=""></p>'), /허용되지 않은 이미지/);
	assert.throws(() => validatePasteHtml('<script>alert(1)</script>'), /허용되지 않은 HTML 태그/);
	assert.throws(() => validatePasteHtml('<a href="https://evil.example.com/">x</a>'), /허용되지 않은 링크/);
});

test('연속된 - 목록은 하나의 <ul>이 되고, 앞뒤 문단과 섞이지 않는다', () => {
	const html = toPasteHtml({ summary: '요약', body: '앞 문단.\n- 첫째\n- 둘째 `코드`\n- 셋째\n뒤 문단.\n\n- 다른 목록' });
	assert.match(html, /<p>앞 문단\.<\/p>\n<ul>\n<li>첫째<\/li>\n<li>둘째 <code>코드<\/code><\/li>\n<li>셋째<\/li>\n<\/ul>\n<p>뒤 문단\.<\/p>\n<ul>\n<li>다른 목록<\/li>\n<\/ul>/);
	assert.ok(!/<p>-/.test(html));
});

test('제목·링크·코드·굵게는 그대로 살아 있다', () => {
	const html = toPasteHtml({
		summary: '**실검** 요약',
		body: '## 소제목\n\n### 작은 제목\n\n[실검](https://silgum.co.kr/?ref=blog_tistory)에서 `a < b & c`를 봅니다. 값 0.03은 그대로.',
	});
	assert.match(html, /<p><strong>실검<\/strong> 요약<\/p>/);
	assert.match(html, /<h2>소제목<\/h2>/);
	assert.match(html, /<h3>작은 제목<\/h3>/);
	assert.match(html, /<a href="https:\/\/silgum\.co\.kr\/\?ref=blog_tistory" target="_blank" rel="noopener">실검<\/a>/);
	assert.match(html, /<code>a &lt; b &amp; c<\/code>/);
	assert.match(html, /0\.03은 그대로/);
	assert.ok(validatePasteHtml(html));
});

test('모델 출력 검사: 블로그 이미지는 통과, 외부 이미지와 생 HTML은 거부', () => {
	const filler = '실검은 여러 검색 서비스를 한 화면에서 오가게 해 주는 검색 허브입니다. '.repeat(14);
	const make = (extra) => ({
		title: '실검 첫 화면 둘러보기',
		summary: '실검 첫 화면에서 검색과 실시간 트렌드를 함께 쓰는 방법을 짧게 정리했습니다.',
		body: '## 첫 화면\n\n' + extra + '\n\n' + filler + '\n\n## 써 보기\n\n[실검](https://silgum.co.kr/)에서 바로 써 보세요.',
		tags: ['실검', 'SILGUM', '검색허브'],
	});
	assert.ok(validatePost(make('![첫 화면](' + IMG + ')')));
	assert.throws(() => validatePost(make('![x](https://evil.example.com/a.png)')), /허용되지 않은 이미지/);
	assert.throws(() => validatePost(make('<b>굵게</b>')), /HTML 태그/);
});

test('발췌: 제목과 문장은 원문 그대로, 스크린샷 2장과 캡션, ref 유지', () => {
	const content = readFileSync(PANEL_SOURCE, 'utf8');
	const source = parseSource(content);
	const post = buildExcerpt(source, { original: 'https://blog.silgum.co.kr/blog/silgum-extension-panel-guide/' });
	assert.equal(post.title, source.title);
	assert.ok(post.sentences.length >= 2 && post.sentences.length <= 3);
	for (const sentence of post.sentences) assert.ok(squash(source.body).includes(sentence), '원문에 없는 문장: ' + sentence);
	assert.equal(post.shots.length, 2);
	for (const shot of post.shots) {
		assert.ok(shot.src.startsWith('https://blog.silgum.co.kr/screens/'));
		assert.ok(source.body.includes('*' + shot.caption + '*'), '캡션은 원문 그대로여야 한다');
	}
	assert.match(post.body, /\(https:\/\/blog\.silgum\.co\.kr\/blog\/silgum-extension-panel-guide\/\?ref=blog_tistory\)/);
	assert.match(post.body, /\(https:\/\/silgum\.co\.kr\/\?ref=blog_tistory\)/);
	const html = toPasteHtml(post);
	assert.ok(validatePasteHtml(html));
	assert.equal((html.match(/<img /g) || []).length, 2);
	assert.match(toPasteText(post, 'x', '2026-11-02'), /\[이미지: 검색 도구 안내\]\nhttps:\/\/blog\.silgum\.co\.kr\/screens\/search-tools-1920\.webp/);
});

test('발췌: 외부·상대 이미지는 고르지 않고 최대 3장', () => {
	const body = [
		'![a](https://evil.example.com/a.png)', '![b](../b.png)', '![c](/screens/c.webp)', '![c](/screens/c.webp)',
		'![d](/screens/d.webp)\n*d 캡션*','![e](/screens/e.webp)', '![f](/screens/f.webp)',
	].join('\n\n');
	const shots = extractScreenshots(body);
	assert.deepEqual(shots.map((shot) => shot.src.split('/').pop()), ['c.webp', 'd.webp', 'e.webp']);
	assert.equal(shots[0].caption, 'c');
	assert.equal(shots[1].caption, 'd 캡션');
});

test('--mode 해석: 기본 rewrite, 잘못된 값은 거부', () => {
	assert.equal(parseMode([]), 'rewrite');
	assert.equal(parseMode(['--mode=excerpt']), 'excerpt');
	assert.throws(() => parseMode(['--mode=auto']), /--mode/);
});

/** 임시 폴더에서 스크립트를 실행한다. outbox/tistory 산출물과 GITHUB_OUTPUT을 돌려준다. */
function runScript(args, env) {
	const dir = mkdtempSync(join(tmpdir(), 'tistory-test-'));
	const outputFile = join(dir, 'github-output.txt');
	const logFile = join(dir, 'fetch-log.txt');
	writeFileSync(outputFile, '');
	const childEnv = { ...process.env, ...env, GITHUB_OUTPUT: outputFile, STUB_FETCH_LOG: logFile };
	if (!env.OPENAI_API_KEY) delete childEnv.OPENAI_API_KEY;
	if (!env.STUB_FETCH_REPLY) delete childEnv.STUB_FETCH_REPLY;
	const result = spawnSync(process.execPath, ['--import', STUB, SCRIPT, ...args], { cwd: dir, env: childEnv, encoding: 'utf8' });
	const outputs = Object.fromEntries(readFileSync(outputFile, 'utf8').split('\n').filter(Boolean).map((line) => line.split(/=(.*)/s).slice(0, 2)));
	const fetchCalls = existsSync(logFile) ? readFileSync(logFile, 'utf8').split('\n').filter(Boolean) : [];
	const read = (key) => readFileSync(join(dir, outputs[key]), 'utf8');
	return { dir, result, outputs, fetchCalls, read, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function assertOutboxShape(run) {
	assert.equal(run.result.status, 0, run.result.stderr);
	for (const key of ['out_path', 'out_text_path', 'out_html_path', 'out_image_path']) assert.ok(key in run.outputs, key);
	assert.match(run.outputs.out_path, /^outbox[\\/]tistory[\\/]\d{4}-\d{2}-\d{2}-[^\\/]+\.md$/);
	assert.equal(run.outputs.out_text_path, run.outputs.out_path.replace(/\.md$/, '.txt'));
	assert.equal(run.outputs.out_html_path, run.outputs.out_path.replace(/\.md$/, '.html'));
	const markdown = run.read('out_path');
	for (const heading of ['## 복사할 제목', '## 복사할 본문', '## 복사할 태그', '## 발행 후 기록']) assert.ok(markdown.includes('\n' + heading + '\n'), heading);
	assert.match(markdown, /- 붙인 ref: blog_tistory/);
	assert.ok(validatePasteHtml(run.read('out_html_path')));
	assert.match(run.read('out_text_path'), /========================\n제목\n========================/);
	return markdown;
}

test('발췌 모드 실행: LLM(fetch) 호출이 한 번도 없고 outbox 산출물 형식이 같다', () => {
	const run = runScript(['--mode=excerpt'], { SOURCE_PATH: PANEL_SOURCE });
	try {
		const markdown = assertOutboxShape(run);
		assert.deepEqual(run.fetchCalls, []);
		assert.match(markdown, /- 생성 모델: 없음 \(발췌 모드/);
		const title = markdown.split('## 복사할 제목\n\n')[1].split('\n')[0];
		assert.equal(title, parseSource(readFileSync(PANEL_SOURCE, 'utf8')).title);
		assert.match(run.read('out_html_path'), /https:\/\/silgum\.co\.kr\/\?ref=blog_tistory/);
	} finally {
		run.cleanup();
	}
});

test('재작성 모드 실행: 대역 응답으로 기존 흐름이 그대로 돈다', () => {
	const dir = mkdtempSync(join(tmpdir(), 'tistory-reply-'));
	const reply = join(dir, 'reply.txt');
	const filler = '실검은 검색어를 한 번 넣고 서비스만 바꿔 가며 쓰는 검색 허브입니다. '.repeat(16);
	writeFileSync(reply, [
		'===TITLE===', '실검 패널, 검색 결과 옆에서 바로', '===SUMMARY===',
		'실검 패널은 검색 결과를 보면서 다른 검색 서비스로 바로 넘어가게 해 주는 작은 화면입니다.',
		'===BODY===', '## 패널이란', '', filler, '', '- 검색어 이어서 검색', '- 서비스 바로 선택', '',
		'## 써 보기', '', '[실검](https://silgum.co.kr/tools)에서 설치 방법을 볼 수 있습니다.',
		'===TAGS===', '실검, SILGUM, 검색허브, 패널',
	].join('\n'));
	const run = runScript([], { SOURCE_PATH: PANEL_SOURCE, OPENAI_API_KEY: 'test-dummy-key', OPENAI_MODEL: 'stub/model:free', STUB_FETCH_REPLY: reply });
	try {
		const markdown = assertOutboxShape(run);
		assert.equal(run.fetchCalls.length, 1);
		assert.match(run.fetchCalls[0], /^https:\/\/openrouter\.ai\//);
		assert.match(markdown, /- 생성 모델: stub\/model:free \(OpenRouter, 무료 모델\)/);
		const html = run.read('out_html_path');
		assert.match(html, /<ul>\n<li>검색어 이어서 검색<\/li>\n<li>서비스 바로 선택<\/li>\n<\/ul>/);
		assert.match(html, /https:\/\/silgum\.co\.kr\/tools\?ref=blog_tistory/);
	} finally {
		run.cleanup();
		rmSync(dir, { recursive: true, force: true });
	}
});
