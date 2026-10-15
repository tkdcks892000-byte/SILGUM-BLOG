const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function withBase(path = ''): string {
	const suffix = path.replace(/^\/+/, '');
	return `${basePath}/${suffix}`;
}

export function withoutBase(path: string): string {
	const route = basePath && path.startsWith(basePath) ? path.slice(basePath.length) : path;
	return route || '/';
}
