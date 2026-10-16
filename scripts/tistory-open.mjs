/**
 * 티스토리 발행 도우미 (로컬, Windows).
 *
 * 자동 게시가 아니다. 티스토리 Open API는 종료됐고, 브라우저 자동화·매크로는 약관상 금지다.
 * 이 스크립트는 그 경계를 넘지 않고 사람의 클릭만 줄인다:
 *   1) 제목을 클립보드에 넣는다
 *   2) 글쓰기 페이지를 연다 (TISTORY_BLOG가 있을 때)
 *   3) Enter를 누르면 본문 HTML을 클립보드에 넣는다
 *   4) Enter를 누르면 태그를 클립보드에 넣는다
 * 붙여넣기와 발행 버튼은 사람이 누른다.
 *
 * 사용: npm run tistory:open   (outbox/tistory의 가장 최근 글)
 *       node scripts/tistory-open.mjs <파일.md>
 *       node scripts/tistory-open.mjs --dry-run   (클립보드·브라우저를 건드리지 않고 확인만)
 */

import { spawn } from 'node:child_process';
import { readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';

const CONFIG_PATH = resolve('tistory.config.json');
const OUTBOX_DIR = resolve('outbox', 'tistory');

function section(markdown, heading) {
	const lines = markdown.split(/\r?\n/);
	const start = lines.findIndex((line) => line.trim() === heading);
	if (start === -1) return '';
	const rest = lines.slice(start + 1);
	const end = rest.findIndex((line) => line.startsWith('## '));
	return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

async function pickSourceFile(argument) {
	if (argument && !argument.startsWith('--')) return resolve(argument);
	const entries = await readdir(OUTBOX_DIR).catch(() => []);
	const drafts = entries.filter((name) => name.endsWith('.md')).sort();
	if (drafts.length === 0) throw new Error(OUTBOX_DIR + ' 에 홍보글이 없습니다. Tistory promo post workflow를 먼저 실행하세요.');
	return join(OUTBOX_DIR, drafts.at(-1));
}

async function readBlogName() {
	if (process.env.TISTORY_BLOG) return process.env.TISTORY_BLOG.trim();
	if (existsSync(CONFIG_PATH)) {
		try {
			const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
			if (config.blog) return String(config.blog).trim();
		} catch {
			// fall through to asking
		}
	}
	return '';
}

async function ask(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolveAnswer) => {
		let settled = false;
		const finish = (value) => {
			if (settled) return;
			settled = true;
			rl.close();
			resolveAnswer(value);
		};
		rl.question(question, (answer) => finish(answer.trim()));
		// 자동 실행이나 파이프 입력에서는 EOF가 정상이다. 멈추지 말고 계속한다.
		rl.on('close', () => finish(''));
	});
}

/** Windows 클립보드는 코드페이지 문제로 파이프가 한글을 깨뜨린다. 파일로 넘겨 UTF-8로 읽힌다. */
async function toClipboard(text, dryRun) {
	if (dryRun) {
		console.log('[dry-run] 클립보드에 넣을 내용(' + text.length + '자):\n' + text.slice(0, 200) + (text.length > 200 ? '\n…' : ''));
		return;
	}
	if (process.platform !== 'win32') {
		console.log('Windows가 아니면 클립보드 자동 복사를 지원하지 않습니다. 파일에서 직접 복사하세요.');
		return;
	}
	const tempPath = join(tmpdir(), 'silgum-clipboard-' + Date.now() + '.txt');
	await writeFile(tempPath, text, 'utf8');
	await new Promise((resolveDone, reject) => {
		const child = spawn('powershell', ['-NoProfile', '-Command', "Set-Clipboard -Value ([System.IO.File]::ReadAllText('" + tempPath.replace(/'/g, "''") + "', [System.Text.Encoding]::UTF8))"], { stdio: 'ignore' });
		child.on('error', reject);
		child.on('exit', (code) => (code === 0 ? resolveDone() : reject(new Error('Set-Clipboard 종료 코드 ' + code))));
	});
	await unlink(tempPath).catch(() => {});
}

function openUrl(url, dryRun) {
	if (dryRun) {
		console.log('[dry-run] 브라우저로 열 URL: ' + url);
		return;
	}
	if (process.platform !== 'win32') return;
	spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
}

async function main() {
	const dryRun = process.argv.includes('--dry-run');
	const stepIndex = process.argv.indexOf('--step');
	const step = stepIndex === -1 ? '' : (process.argv[stepIndex + 1] || '').toLowerCase();
	const fileArgument = process.argv.slice(2).find((item) => !item.startsWith('--') && item !== step);
	const sourcePath = await pickSourceFile(fileArgument);
	const markdown = await readFile(sourcePath, 'utf8');
	const htmlPath = sourcePath.replace(/\.md$/, '.html');
	const bodyHtml = await readFile(htmlPath, 'utf8').catch(() => '');
	const title = section(markdown, '## 복사할 제목');
	const tags = section(markdown, '## 복사할 태그').replace(/#/g, '').split(/[\s,]+/).filter(Boolean).join(',');

	// 붙여넣다가 클립보드가 바뀌었을 때 한 조각만 다시 넣는 경로.
	if (step) {
		const pieces = { title, body: bodyHtml, tags };
		if (!(step in pieces)) throw new Error('--step 은 title, body, tags 중 하나여야 합니다.');
		if (!pieces[step]) throw new Error(step + ' 내용이 비어 있습니다. (' + basename(sourcePath) + ')');
		await toClipboard(pieces[step], dryRun);
		if (!dryRun) console.log(step + ' 을(를) 클립보드에 넣었습니다. (' + pieces[step].length + '자)');
		return;
	}

	console.log('홍보글: ' + basename(sourcePath));
	console.log('제목  : ' + title);
	console.log('태그  : ' + tags);
	if (!bodyHtml) console.log('경고: 같은 이름의 .html이 없어 본문 자동 복사를 건너뜁니다.');
	console.log('');

	await toClipboard(title, dryRun);
	console.log('1/3 제목을 클립보드에 넣었습니다.');

	const blog = await readBlogName();
	if (blog) {
		openUrl('https://' + blog + '/manage/newpost/', dryRun);
		console.log('2/3 글쓰기 페이지를 열었습니다. 제목 칸에 붙여넣고 Enter를 누르세요.');
	} else {
		console.log('2/3 TISTORY_BLOG가 없어 페이지를 열지 않았습니다. 티스토리 글쓰기 페이지를 직접 열고 제목을 붙여넣으세요.');
	}
	await ask('준비되면 Enter… ');

	if (bodyHtml) {
		await toClipboard(bodyHtml, dryRun);
		console.log('3/3 본문 HTML을 클립보드에 넣었습니다. 에디터를 HTML 모드로 바꿔 붙여넣으세요.');
	}
	await ask('붙여넣었으면 Enter… ');

	await toClipboard(tags, dryRun);
	console.log('태그를 클립보드에 넣었습니다. 태그 칸에 붙여넣고 발행하세요.');
	console.log('');
	console.log('발행 후 ' + basename(sourcePath) + ' 의 "발행 후 기록"에 URL과 날짜를 적어 두세요.');
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
