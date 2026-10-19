import type { CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'blog'>;

/**
 * 목록 순서: `pinned: true` 글이 먼저, 그다음 최신순.
 *
 * 날짜를 앞당겨 순서를 바꾸지 않는다. 발행일은 기록이고, 강조는 별도 필드로 표현한다.
 */
export function sortPosts(posts: Post[]): Post[] {
	return [...posts].sort((a, b) => {
		const pinnedA = a.data.pinned === true ? 1 : 0;
		const pinnedB = b.data.pinned === true ? 1 : 0;
		if (pinnedA !== pinnedB) return pinnedB - pinnedA;
		return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
	});
}
