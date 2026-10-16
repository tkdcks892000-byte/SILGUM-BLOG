import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { publicReferenceUrls, withChannelRef } from './silgum-links.mjs';

const BLOG_REF = 'blog';

const headRef = process.env.PULL_REQUEST_HEAD_REF || '';
const match = headRef.match(/^automation\/evidence-draft-([0-9a-f]{12})$/);
if (!match) throw new Error('Pull request branch is not an evidence-draft branch.');

function git(args) {
	return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
}

async function exists(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

if (git(['branch', '--show-current']).trim() !== 'main') {
	throw new Error('Publication workflow must run from main.');
}
git(['fetch', 'origin', 'main']);
git(['merge', '--ff-only', 'origin/main']);

const sourcePath = 'drafts/evidence-' + match[1] + '.md';
const fileSlug = sourcePath.split('/').at(-1);
const approvedArchivePath = 'published/' + fileSlug;
if (!(await exists(sourcePath))) {
	if (await exists('published/' + fileSlug)) {
		console.log('This approved draft has already been published.');
		process.exit(0);
	}
	throw new Error('The merged pull request does not contain the expected draft file.');
}
if (await exists(approvedArchivePath)) throw new Error('A published draft archive already exists.');

const content = await readFile(sourcePath, 'utf8');
const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
if (!frontmatter) throw new Error('Draft frontmatter is missing or malformed.');

function readJsonField(name) {
	const prefix = name + ': ';
	const line = frontmatter[1].split(/\r?\n/).find((item) => item.startsWith(prefix));
	if (!line) throw new Error('Draft is missing the ' + name + ' field.');
	return JSON.parse(line.slice(prefix.length));
}

const title = readJsonField('title');
const description = readJsonField('description');
const slug = readJsonField('slug');
const markdown = withChannelRef(frontmatter[2].trim(), BLOG_REF);
if (/\b(?:sk-(?:proj|svcacct)-|sk-[A-Za-z0-9]{32,}|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{20,}\b/i.test(content)) {
	throw new Error('Draft contains secret-shaped text.');
}
if (typeof title !== 'string' || title.trim().length < 4 || title.length > 100) {
	throw new Error('Draft title is invalid.');
}
if (typeof description !== 'string' || description.trim().length < 20 || description.length > 220) {
	throw new Error('Draft description is invalid.');
}
if (typeof slug !== 'string' || slug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
	throw new Error('Draft URL slug is invalid.');
}
if (markdown.length < 700 || markdown.length > 8_000 || /^#\s/m.test(markdown)) {
	throw new Error('Draft body length or heading structure is invalid.');
}
const headingCount = (markdown.match(/^#{2,3}\s.+$/gm) || []).length;
if (headingCount < 2 || headingCount > 4) throw new Error('Draft must have two to four section headings.');
if (/(?:저는|제가|저희가|내가|우리가|제 경험|혼자 (?:만들|개발)|직접 (?:개발|구현|작성)|실제로 겪)/.test(markdown)) {
	throw new Error('Draft includes first-person operator experience.');
}
if (/<[a-z][^>]*>/i.test(markdown)) throw new Error('Draft includes raw HTML.');

const publicUrls = new Set(publicReferenceUrls(BLOG_REF));
const urls = markdown.match(/https:\/\/[^\s)\]>"']+/g) || [];
if (!urls.some((url) => publicUrls.has(url.replace(/[.,;]+$/, '')))) {
	throw new Error('Draft does not cite an approved SILGUM page.');
}
if (urls.some((url) => !publicUrls.has(url.replace(/[.,;]+$/, '')))) {
	throw new Error('Draft contains an unapproved URL.');
}
const linkTargets = [...markdown.matchAll(/\]\(([^)]+)\)/g)].map((item) => item[1].trim());
if (linkTargets.some((url) => !publicUrls.has(url))) {
	throw new Error('Draft contains a non-allowlisted Markdown link.');
}

const destinationPath = 'src/content/blog/' + slug + '.md';
if (await exists(destinationPath)) throw new Error('A published article already uses this URL slug.');
const dateParts = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Asia/Seoul',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
}).formatToParts(new Date());
const part = (type) => dateParts.find((item) => item.type === type)?.value;
const pubDate = part('year') + '-' + part('month') + '-' + part('day');
const publishedContent = [
	'---',
	'title: ' + JSON.stringify(title.trim()),
	'description: ' + JSON.stringify(description.trim()),
	'pubDate: ' + JSON.stringify(pubDate),
	'---',
	'',
	markdown,
	'',
].join('\n');
await mkdir(dirname(destinationPath), { recursive: true });
await mkdir(dirname(approvedArchivePath), { recursive: true });
await writeFile(destinationPath, publishedContent, 'utf8');
await rename(sourcePath, approvedArchivePath);
git(['add', '--', sourcePath, approvedArchivePath, destinationPath]);
git(['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-m', 'content: publish approved SILGUM article']);
git(['push', 'origin', 'main']);
console.log('Published approved article at ' + destinationPath + ' with date ' + pubDate + '.');

