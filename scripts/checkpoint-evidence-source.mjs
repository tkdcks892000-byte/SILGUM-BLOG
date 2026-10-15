import { updateCheckpoint } from './github-api.mjs';

const sourceSha = process.env.SOURCE_SHA;
if (!sourceSha || !/^[0-9a-f]{40}$/i.test(sourceSha)) {
	throw new Error('SOURCE_SHA must be a full Git commit SHA.');
}

await updateCheckpoint({
	sourceSha,
	processedAt: new Date().toISOString(),
	outcome: 'draft-pull-request-created',
	model: process.env.OPENAI_MODEL || 'gpt-6-luna',
});
console.log('Recorded processed source commit ' + sourceSha + '.');

