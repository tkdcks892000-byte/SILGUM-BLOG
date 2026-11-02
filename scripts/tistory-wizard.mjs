/**
 * 티스토리 글쓰기 도우미 (더블클릭용, Windows).
 *
 * `티스토리 글쓰기.cmd`를 더블클릭하면 이 메뉴가 뜬다. 명령어를 칠 필요 없이 번호만 고른다.
 *   1) 원문을 골라 홍보글을 만들고(발췌 모드, 모델 호출 없음) 바로 붙여넣기 메뉴로 간다
 *   2) 이미 만든 홍보글을 골라 붙여넣기 메뉴로 간다 (scripts/tistory-open.mjs)
 *   3) 발행한 글의 주소를 "발행 후 기록"에 적는다
 * 자동 게시는 하지 않는다. 붙여넣기와 발행 버튼은 사람이 누른다.
 */

import { spawn } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const BLOG_DIR = join('src', 'content', 'blog');
const OUTBOX_DIR = join('outbox', 'tistory');

/** One question at a time, so a child process can own the console in between. */
function ask(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((done) => rl.question(question, (answer) => { rl.close(); done(answer.trim()); }));
}

function run(script, args = [], env = {}) {
	return new Promise((done) => {
		const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit', env: { ...process.env, ...env } });
		child.on('exit', (code) => done(code ?? 1));
	});
}

const frontTitle = (markdown) => /^title:\s*"?(.*?)"?\s*$/m.exec(markdown)?.[1] ?? '';
const section = (markdown, heading) => markdown.split(heading)[1]?.split(/\n## /)[0]?.trim() ?? '';
const kstToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function listSources() {
	const names = (await readdir(BLOG_DIR)).filter((name) => name.endsWith('.md')).sort();
	const made = new Set((await readdir(OUTBOX_DIR).catch(() => [])).filter((name) => name.endsWith('.md')).map((name) => name.replace(/^\d{4}-\d{2}-\d{2}-/, '')));
	return Promise.all(names.map(async (name) => ({ path: join(BLOG_DIR, name), title: frontTitle(await readFile(join(BLOG_DIR, name), 'utf8')), made: made.has(name) })));
}

async function listOutbox() {
	const names = (await readdir(OUTBOX_DIR).catch(() => [])).filter((name) => name.endsWith('.md'));
	const items = await Promise.all(names.map(async (name) => {
		const path = join(OUTBOX_DIR, name);
		const markdown = await readFile(path, 'utf8');
		// [ \t]*, not \s*: an empty field must not borrow the next line.
		const url = /^- 발행 URL:[ \t]*(\S*)/m.exec(markdown)?.[1] ?? '';
		return { path, name, title: section(markdown, '## 복사할 제목'), url, at: (await stat(path)).mtimeMs };
	}));
	return items.sort((a, b) => b.at - a.at);
}

async function choose(items, label) {
	items.forEach((item, index) => console.log(`  ${String(index + 1).padStart(2)}  ${label(item)}`));
	const answer = await ask('\n번호 (그냥 Enter = 돌아가기)> ');
	const index = Number(answer) - 1;
	return Number.isInteger(index) && items[index] ? items[index] : null;
}

async function makePost() {
	console.log('\n어느 원문으로 홍보글을 만들까요? (✓ = 이미 만든 적 있음)\n');
	const source = await choose(await listSources(), (item) => `${item.made ? '✓' : ' '} ${item.title || item.path}`);
	if (!source) return;
	const before = Date.now();
	console.log('\n만드는 중… (원문에서 그대로 뽑습니다. 인공지능을 부르지 않습니다)\n');
	const code = await run('scripts/generate-tistory-post.mjs', ['--mode=excerpt'], { SOURCE_PATH: source.path });
	if (code !== 0) { console.log('\n만들지 못했습니다. 위 메시지를 확인해 주세요.'); return; }
	const fresh = (await listOutbox()).find((item) => item.at >= before - 1000);
	if (!fresh) { console.log('\n만든 파일을 찾지 못했습니다. 메뉴 2에서 골라 주세요.'); return; }
	console.log(`\n만들었습니다: ${fresh.name}\n이어서 붙여넣기 메뉴를 엽니다.\n`);
	await run('scripts/tistory-open.mjs', [fresh.path]);
}

async function pastePost() {
	console.log('\n어느 홍보글을 올릴까요? (최근 순, ✓ = 발행 기록 있음)\n');
	const post = await choose(await listOutbox(), (item) => `${item.url ? '✓' : ' '} ${item.title || item.name}`);
	if (post) await run('scripts/tistory-open.mjs', [post.path]);
}

async function recordPost() {
	console.log('\n어느 글의 발행 기록을 적을까요?\n');
	const post = await choose((await listOutbox()).filter((item) => !item.url), (item) => item.title || item.name);
	if (!post) return;
	const url = await ask('발행한 티스토리 글 주소를 붙여넣으세요 (예: https://sil-gum.tistory.com/4)> ');
	if (!/^https:\/\/[a-z0-9-]+\.tistory\.com\/\S+$/i.test(url)) { console.log('티스토리 글 주소가 아닙니다. 적지 않았습니다.'); return; }
	const markdown = await readFile(post.path, 'utf8');
	const next = markdown.replace(/^- 발행 URL:[^\r\n]*/m, `- 발행 URL: ${url}`).replace(/^- 발행일:[^\r\n]*/m, `- 발행일: ${kstToday()}`);
	await writeFile(post.path, next, 'utf8');
	console.log(`적었습니다: ${post.name}`);
}

async function main() {
	process.chdir(resolve(import.meta.dirname, '..'));
	for (;;) {
		console.log('\n=== 티스토리 글쓰기 ===');
		console.log('  1  새 홍보글 만들고 올리기');
		console.log('  2  만들어 둔 홍보글 올리기');
		console.log('  3  발행한 글 주소 기록하기');
		console.log('  q  끝내기');
		const choice = (await ask('\n번호> ')).toLowerCase();
		if (choice === '1') await makePost();
		else if (choice === '2') await pastePost();
		else if (choice === '3') await recordPost();
		else if (choice === 'q' || choice === '') return;
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
