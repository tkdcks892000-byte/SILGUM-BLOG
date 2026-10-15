# SILGUM 개발일지

Astro 정적 블로그. Markdown 글은 `src/content/blog/`에 추가하고 기본 branch `main`에 push하면 GitHub Actions가 GitHub Pages로 배포한다.

## 로컬 실행

```sh
npm install
npm run dev
npm run build
npm run preview
```

## GitHub Pages 연결

이 프로젝트는 `https://tkdcks892000-byte.github.io/silgum-blog/` 주소를 기준으로 `site`와 `base`가 설정되어 있다.

1. GitHub 계정 `tkdcks892000-byte`에 `silgum-blog` 이름의 **공개 저장소**를 만든다. GitHub Free에서는 Pages가 공개 저장소에서 제공된다.
2. 저장소 Settings → Pages → Build and deployment에서 Source를 **GitHub Actions**로 선택한다.
3. `main` branch를 원격에 push한다. `.github/workflows/deploy.yml`이 빌드·배포한다.

이 폴더는 현재 별도 로컬 Git 저장소다. 원격 저장소는 아직 연결하지 않았다.

## 글 발행 기준

- `src/content/blog/`에는 발행 가능한 글만 둔다. 확인 전 원고와 개인 기억의 빈칸은 게시하지 않는다.
- 검색 수치는 SILGUM 안에서 관측한 값이라고 표시한다. 외부 검색량이나 트렌드로 부풀려 쓰지 않는다.
- SILGUM 링크의 글별 `ref` 값은 앱에서 인식하도록 추가한 뒤 사용한다. 현재 `blog_dev_01`은 허용되지 않아 `unknown`으로 기록된다.
