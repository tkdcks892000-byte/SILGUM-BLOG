const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

export async function githubRequest(path, { method = 'GET', body, allowNotFound = false } = {}) {
	if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');
	const response = await fetch('https://api.github.com/repos/' + repository + '/' + path, {
		method,
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: 'Bearer ' + token,
			'X-GitHub-Api-Version': '2022-11-28',
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	if (response.status === 404 && allowNotFound) return null;
	if (!response.ok) {
		const message = (await response.text()).slice(0, 500);
		throw new Error('GitHub API ' + method + ' ' + path + ' failed (' + response.status + '): ' + message);
	}
	return response.status === 204 ? null : response.json();
}

export async function getCheckpoint() {
	const file = await githubRequest('contents/state.json?ref=automation-state', { allowNotFound: true });
	if (!file?.content) return null;
	return JSON.parse(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8'));
}

export async function updateCheckpoint(checkpoint) {
	let stateRef = await githubRequest('git/ref/heads/automation-state', { allowNotFound: true });
	if (!stateRef) {
		const mainRef = await githubRequest('git/ref/heads/main');
		try {
			await githubRequest('git/refs', {
				method: 'POST',
				body: { ref: 'refs/heads/automation-state', sha: mainRef.object.sha },
			});
		} catch (error) {
			// A concurrent first run may have created the state branch.
			stateRef = await githubRequest('git/ref/heads/automation-state', { allowNotFound: true });
			if (!stateRef) throw error;
		}
	}

	const existingFile = await githubRequest('contents/state.json?ref=automation-state', { allowNotFound: true });
	await githubRequest('contents/state.json', {
		method: 'PUT',
		body: {
			message: 'chore: checkpoint evidence draft source',
			content: Buffer.from(JSON.stringify(checkpoint, null, 2) + '\n').toString('base64'),
			branch: 'automation-state',
			...(existingFile?.sha ? { sha: existingFile.sha } : {}),
		},
	});
}

