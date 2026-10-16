/**
 * OpenRouter 호출 공통 헬퍼.
 *
 * 무료 모델만 쓴다. 무료 티어는 제공자 공유 풀이라 특정 모델이 429(일시 제한)를 자주 돌려준다.
 * 그래서 모델을 하나만 쓰지 않고 순서대로 시도한다(폴백). 유료 모델은 계정 크레딧이 필요하므로
 * 기본 목록에 넣지 않는다.
 */

const FREE_FALLBACK_MODELS = [
	'poolside/laguna-s-2.1:free',
	'nvidia/nemotron-3-super-120b-a12b:free',
	'dots-studio/dots-3-note-preview:free',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `OPENAI_MODEL`을 쉼표로 나눈 목록으로 읽는다. 비어 있으면 무료 폴백 목록을 쓴다. */
export function resolveModels(value) {
	const list = (value || '').split(',').map((item) => item.trim()).filter(Boolean);
	return list.length > 0 ? list : FREE_FALLBACK_MODELS;
}

export function defaultModelList() {
	return FREE_FALLBACK_MODELS.join(',');
}

/**
 * 여러 모델을 순서대로 시도해 첫 성공 응답 텍스트를 돌려준다.
 * 반환: { model, content }
 */
export async function chatCompletion({ apiKey, models, messages, maxTokens, temperature, referer, title }) {
	if (!apiKey) throw new Error('OPENAI_API_KEY가 필요합니다.');
	if (!Array.isArray(models) || models.length === 0) throw new Error('모델 목록이 비었습니다.');
	let lastError = new Error('사용 가능한 무료 모델을 찾지 못했습니다.');

	for (let pass = 0; pass < 2; pass += 1) {
		for (const model of models) {
			let sendReasoningOff = true;
			for (let attempt = 0; attempt < 2; attempt += 1) {
				const payload = { model, messages, max_tokens: maxTokens, temperature };
				if (sendReasoningOff) payload.reasoning = { enabled: false };
				let response;
				try {
					response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
						method: 'POST',
						headers: {
							Authorization: 'Bearer ' + apiKey,
							'Content-Type': 'application/json',
							'HTTP-Referer': referer || 'https://github.com/SILGUM-BLOG',
							'X-Title': title || 'SILGUM content automation',
						},
						body: JSON.stringify(payload),
					});
				} catch (error) {
					lastError = error;
					break;
				}
				if (response.ok) {
					const data = await response.json();
					const content = data.choices?.[0]?.message?.content;
					if (typeof content === 'string' && content.trim()) return { model, content };
					lastError = new Error(model + ': 빈 응답');
					break;
				}
				const detail = (await response.text()).slice(0, 400);
				lastError = new Error('LLM API failed (' + response.status + ') [' + model + ']: ' + detail);
				if (response.status === 401) throw lastError;
				// 일부 모델은 reasoning 파라미터를 거부한다. 빼고 한 번 더 시도한다.
				if (response.status === 400 && sendReasoningOff) {
					sendReasoningOff = false;
					continue;
				}
				if (response.status === 429) await sleep(3_000);
				break;
			}
		}
		if (pass === 0) await sleep(5_000);
	}
	throw lastError;
}
