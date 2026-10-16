/**
 * 무료 모델의 출력을 안정적으로 읽기 위한 구분자 파서.
 *
 * JSON은 무료 모델에서 이스케이프가 자주 깨진다. 대신 `===NAME===` 줄을 구분자로 써서
 * 값 사이를 잘라 낸다. 마크다운 본문처럼 줄바꿈·따옴표가 많은 값도 그대로 담긴다.
 */

/** names는 기대하는 순서다. 일부만 있어도 되지만, 있는 것끼리는 이 순서를 지켜야 한다. */
export function parseMarkers(text, names) {
	const cleaned = String(text).replace(/^```[a-z]*\s*|\s*```$/g, '').trim();
	const indexed = names.map((name) => ({ name, index: cleaned.indexOf('===' + name + '===') }));
	const present = indexed.filter((item) => item.index !== -1).sort((a, b) => a.index - b.index);
	if (present.length === 0) {
		throw new Error('구분자를 찾지 못했습니다. ' + names.map((name) => '===' + name + '===').join(', ') + ' 형식으로 다시 출력하세요.');
	}
	const expectedOrder = names.filter((name) => present.some((item) => item.name === name));
	if (present.map((item) => item.name).join(',') !== expectedOrder.join(',')) {
		throw new Error('구분자 순서가 잘못되었습니다(' + present.map((item) => item.name).join(', ') + '). ' + expectedOrder.join(', ') + ' 순서로 다시 출력하세요.');
	}
	const values = {};
	for (let i = 0; i < present.length; i += 1) {
		const start = present[i].index + ('===' + present[i].name + '===').length;
		const end = i + 1 < present.length ? present[i + 1].index : cleaned.length;
		values[present[i].name] = cleaned.slice(start, end).trim();
	}
	return values;
}
