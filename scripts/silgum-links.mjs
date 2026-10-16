/**
 * SILGUM 공개 링크에 채널 ref를 붙이는 공통 규칙.
 *
 * 앱의 acquisition 허용 목록(app/lib/acquisition/ref.ts)에 없는 값은 unknown으로 기록되므로,
 * 링크를 만들 때 반드시 허용된 채널(blog, blog_tistory)을 쓴다.
 */

export const PRODUCT_URL = 'https://silgum.co.kr';

/** 공개 참조로 쓸 수 있는 페이지 경로. */
export const PUBLIC_PATHS = ['/terms', '/about', '/tools'];

export function publicReferenceUrls(channel) {
	return PUBLIC_PATHS.map((path) => PRODUCT_URL + path + '?ref=' + channel);
}

/**
 * 본문의 모든 silgum.co.kr 링크에 채널 ref를 붙인다(이미 있어도 덮어쓴다).
 * 모델이 ref 없이 링크를 만들었을 때도 추적값이 빠지지 않게 한다.
 */
export function withChannelRef(text, channel) {
	return String(text).replace(/https:\/\/silgum\.co\.kr(\/[^\s)\]>"']*)?/g, (match, path) => {
		const cleanPath = (path || '/').replace(/[.,;]+$/, '');
		const [base, query] = cleanPath.split('?');
		const params = new URLSearchParams(query || '');
		params.set('ref', channel);
		return PRODUCT_URL + base + '?' + params.toString();
	});
}
