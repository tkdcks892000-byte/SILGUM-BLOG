/**
 * 테스트 전용 fetch 대역. `node --import` 로 먼저 불러 실제 네트워크(OpenRouter 포함)를 막는다.
 * 호출된 URL은 STUB_FETCH_LOG에 한 줄씩 남긴다. STUB_FETCH_REPLY가 있으면 그 파일 내용을
 * OpenRouter 응답(choices[0].message.content)으로 돌려주고, 없으면 호출 자체를 실패시킨다.
 */

import { appendFileSync, readFileSync } from 'node:fs';

globalThis.fetch = async (url) => {
	if (process.env.STUB_FETCH_LOG) appendFileSync(process.env.STUB_FETCH_LOG, String(url) + '\n');
	if (!process.env.STUB_FETCH_REPLY) throw new Error('테스트에서는 네트워크를 쓰지 않습니다: ' + url);
	const content = readFileSync(process.env.STUB_FETCH_REPLY, 'utf8');
	return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};
