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
	await runPowerShell("Set-Clipboard -Value ([System.IO.File]::ReadAllText('{PATH}', [System.Text.Encoding]::UTF8))", text);
}

/**
 * HTML 서식으로 클립보드에 넣는다. 티스토리 기본 에디터에 붙여넣으면 소제목·링크가 서식으로 들어가서
 * HTML 모드로 바꾸는 단계를 건너뛸 수 있다.
 *
 * Windows 클립보드의 HTML 형식(CF_HTML)은 헤더에 바이트 오프셋을 요구한다. 그리고 텍스트 형식도 함께
 * 넣어야 한다 — 서식을 지원하지 않는 입력칸에 붙여넣어도 평문이 나오도록.
 */
const HTML_CLIPBOARD_SCRIPT = [
	'$frag = [System.IO.File]::ReadAllText(\'{PATH}\', [System.Text.Encoding]::UTF8)',
	"$html = '<html><body><!--StartFragment-->' + $frag + '<!--EndFragment--></body></html>'",
	'$template = "Version:0.9`r`nStartHTML:{0:D10}`r`nEndHTML:{1:D10}`r`nStartFragment:{2:D10}`r`nEndFragment:{3:D10}`r`n"',
	'$placeholder = $template -f 0,0,0,0',
	'$headerLength = [System.Text.Encoding]::UTF8.GetByteCount($placeholder)',
	'$startFragment = $headerLength + [System.Text.Encoding]::UTF8.GetByteCount("<html><body><!--StartFragment-->")',
	'$startHtml = $headerLength',
	'$endHtml = $headerLength + [System.Text.Encoding]::UTF8.GetByteCount($html)',
	'$endFragment = $startFragment + [System.Text.Encoding]::UTF8.GetByteCount($frag)',
	'$cfHtml = ($template -f $startHtml,$endHtml,$startFragment,$endFragment) + $html',
	'Add-Type -AssemblyName System.Windows.Forms',
	'$data = New-Object System.Windows.Forms.DataObject',
	'$data.SetData([System.Windows.Forms.DataFormats]::UnicodeText, $frag)',
	'$data.SetData([System.Windows.Forms.DataFormats]::Html, $cfHtml)',
	'[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)',
].join('; ');

async function toClipboardAsHtml(text, dryRun) {
	if (dryRun) {
		console.log('[dry-run] 클립보드(텍스트+HTML 서식)로 넣을 내용(' + text.length + '자)');
		return;
	}
	if (process.platform !== 'win32') {
		console.log('Windows가 아니면 HTML 클립보드를 지원하지 않습니다.');
		return;
	}
	await runPowerShell(HTML_CLIPBOARD_SCRIPT, text);
}

async function runPowerShell(commandTemplate, text) {
	const tempPath = join(tmpdir(), 'silgum-clipboard-' + Date.now() + '.txt');
	await writeFile(tempPath, text, 'utf8');
	const command = commandTemplate.replace('{PATH}', tempPath.replace(/'/g, "''"));
	await new Promise((resolveDone, reject) => {
		const child = spawn('powershell', ['-NoProfile', '-Command', command], { stdio: 'ignore' });
		child.on('error', reject);
		child.on('exit', (code) => (code === 0 ? resolveDone() : reject(new Error('클립보드 설정 실패 (종료 코드 ' + code + ')'))));
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

	const pieces = { title, body: bodyHtml, tags };

	// 붙여넣다가 클립보드가 바뀌었을 때 한 조각만 다시 넣는 경로.
	if (step) {
		if (!(step in pieces)) throw new Error('--step 은 title, body, tags 중 하나여야 합니다.');
		if (!pieces[step]) throw new Error(step + ' 내용이 비어 있습니다. (' + basename(sourcePath) + ')');
		await toClipboard(pieces[step], dryRun);
		if (!dryRun) console.log(step + ' 을(를) 클립보드에 넣었습니다. (' + pieces[step].length + '자)');
		return;
	}

	const blog = await readBlogName();
	if (!dryRun && blog && !process.argv.includes('--no-open')) {
		openUrl('https://' + blog + '/manage/newpost/', false);
		console.log('글쓰기 페이지를 열었습니다: https://' + blog + '/manage/newpost/\n');
	}

	// 기본은 메뉴 방식이다. Enter 순서에 기대지 않아서 클립보드가 엉키지 않는다.
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const inputLines = rl[Symbol.asyncIterator]();

	console.log('홍보글: ' + basename(sourcePath));
	console.log('제목  : ' + title);
	console.log('태그  : ' + tags);
	if (!bodyHtml) console.log('경고: 같은 이름의 .html이 없어 본문 복사를 건너뜁니다.');
	console.log('');
	console.log('  1 제목 복사          2 본문 복사(HTML 모드에 붙여넣기)');
	console.log('  3 본문 복사(서식 유지, 기본 에디터에 붙여넣기)   4 태그 복사');
	console.log('  5 글쓰기 페이지 열기   q 끝내기');
	console.log('');
	console.log('필요한 번호를 누르세요. 여러 번 눌러도 됩니다. 발행 버튼은 직접 누르세요.');

	try {
		for (;;) {
			process.stdout.write('번호> ');
			const next = await inputLines.next();
			if (next.done) break;
			const choice = String(next.value).trim();
			if (choice === 'q' || choice === '') break;
			if (choice === '1') { await toClipboard(title, dryRun); console.log('→ 제목 (' + title.length + '자)'); }
			else if (choice === '2') { await toClipboard(bodyHtml, dryRun); console.log('→ 본문 ' + bodyHtml.length + '자. 에디터를 HTML 모드로 바꿔 붙여넣으세요.'); }
			else if (choice === '3') { await toClipboardAsHtml(bodyHtml, dryRun); console.log('→ 본문(서식 유지) ' + bodyHtml.length + '자. 기본 에디터에 그냥 붙여넣어 보세요.'); }
			else if (choice === '4') { await toClipboard(tags, dryRun); console.log('→ 태그'); }
			else if (choice === '5') { openUrl('https://' + (blog || 'sil-gum') + '/manage/newpost/', dryRun); console.log('→ 글쓰기 페이지'); }
			else console.log('1~5 또는 q 를 입력하세요.');
		}
	} finally {
		rl.close();
	}

	console.log('');
	console.log('발행 후 ' + basename(sourcePath) + ' 의 "발행 후 기록"에 URL과 날짜를 적어 두세요.');
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
