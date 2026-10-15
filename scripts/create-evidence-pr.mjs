import { readFile } from 'node:fs/promises';
import { githubRequest } from './github-api.mjs';

const repository = process.env.GITHUB_REPOSITORY;
const branch = process.env.DRAFT_BRANCH;
const title = process.env.DRAFT_TITLE;
const bodyPath = process.env.DRAFT_BODY_PATH;

if (!repository || !branch || !title || !bodyPath) {
	throw new Error('GITHUB_REPOSITORY, DRAFT_BRANCH, DRAFT_TITLE, and DRAFT_BODY_PATH are required.');
}

const [owner] = repository.split('/');
const head = encodeURIComponent(owner + ':' + branch);
const existing = await githubRequest('pulls?state=open&head=' + head);
if (existing?.length) {
	console.log('Draft review PR already exists: ' + existing[0].html_url);
} else {
	const body = await readFile(bodyPath, 'utf8');
	const pullRequest = await githubRequest('pulls', {
		method: 'POST',
		body: { title, head: branch, base: 'main', body, draft: true },
	});
	console.log('Created draft review PR: ' + pullRequest.html_url);
}

