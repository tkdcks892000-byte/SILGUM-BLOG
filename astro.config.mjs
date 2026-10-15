import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
	site: 'https://tkdcks892000-byte.github.io',
	base: '/silgum-blog',
	integrations: [mdx(), sitemap()],
});
