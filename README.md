# SILGUM 콘텐츠 블로그

Astro 정적 사이트입니다. Markdown 원고는 `src/content/blog/`에 두고 `main` push 때 GitHub Actions가 빌드해 GitHub Pages에 배포합니다. 글의 원본은 이 Git 저장소이며, 외부 플랫폼에 동일한 전문을 자동 복제하지 않습니다.

## 로컬 실행

```sh
npm ci
npm run dev
npm run build
npm run preview
```

## GitHub Pages 연결

배포는 GitHub Actions workflow(`deploy.yml`)가 담당합니다. 대시보드에서:

- Settings → Pages → Source: **GitHub Actions**
- main push 또는 수동 실행으로 빌드·배포
- Custom domain: `blog.silgum.co.kr` (Gabia DNS에 A 레코드 추가, 상세 값은 대시보드 안내 참조)
- Enforce HTTPS: 도메인 확인 후 체크

Cloudflare은 사용하지 않습니다. `automation-state` 브랜치는 배포 대상이 아닙니다. 콘텐츠 검토 PR preview는 원고를 발행하지 않으며, drafts/는 Astro 콘텐츠 컬렉션에 포함되지 않습니다.

## 근거 기반 초안 자동화

.github/workflows/evidence-draft.yml은 매주 월요일과 수동 실행 때 SILGUM 저장소의 허용 파일 변경을 확인합니다. 변경이 없으면 모델을 호출하지 않습니다. 변경이 있어도 독자에게 유용하고 중복되지 않는 설명이 없으면 초안을 만들지 않습니다.

현재 읽기 허용 목록은 다음 파일뿐입니다.

- app/lib/trends/config.ts
- app/lib/trends/score.ts — 변경된 diff만 전달
- app/terms/page.tsx
- docs/COLD-START.md

초기 실행은 설정·약관·콜드스타트 문서의 현재 내용을 한 번 읽어 기준점을 만듭니다. 운영 리포트, 데이터베이스, 원시 검색어, 세션 식별자, 뉴스 본문은 수집하지 않습니다. 지정 파일의 근거에서 초안을 생성한 다음 출처 파일, 문장 길이, 공개 SILGUM 링크, 외부 URL, 운영자 1인칭 경험 표현을 검사합니다. 기존 공개 글과 열린 자동 초안 PR의 제목도 모델에 전달해 제목 수준의 반복을 줄입니다. 통과한 원고는 두 번째 모델 호출로 한 번 더 사실 확인합니다(근거와 어긋나는 문장을 찾아 고침). 두 단계 모두 무료 모델만 씁니다. 의미상 중복·사실·저작권은 자동 검사가 보증하지 않으므로 PR에서 확인합니다. 통과한 원고는 drafts/에 저장하고 비공개 draft PR을 엽니다. 이 단계에서는 게시되지 않습니다.

### 저장소 설정

블로그 GitHub 저장소를 비공개로 만든 뒤 Settings → Secrets and variables → Actions에 다음을 등록합니다.

- SILGUM_SOURCE_READ_TOKEN: fine-grained token. SILGUM 앱 저장소 하나만 지정하고 Contents: read 권한만 부여합니다.
- OPENAI_API_KEY: 원고 생성에 쓰는 키. 현재 스크립트는 OpenRouter API를 쓰므로 OpenRouter 키를 등록합니다. (이름은 하네스 호환을 위해 OPENAI_API_KEY로 유지)
- 선택 사항인 Actions variable OPENAI_MODEL: OpenRouter 모델 ID를 쉼표로 구분해 여러 개 넣을 수 있습니다. 접두사 `openrouter/`는 붙이지 않습니다. 비워 두면 스크립트의 무료 폴백 목록(`poolside/laguna-s-2.1:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `dots-studio/dots-3-note-preview:free`)을 앞에서부터 시도합니다. 무료 티어는 제공자 공유 풀이라 특정 모델이 429를 돌려주면 다음 모델로 넘어갑니다. `:free`가 없는 모델은 계정 크레딧이 필요하므로 넣지 않습니다. 무료 모델 목록은 OpenRouter `/api/v1/models`에서 `:free` 접미사로 확인합니다.

워크플로는 블로그 저장소의 기본 GITHUB_TOKEN에만 Contents: write와 Pull requests: write를 요청합니다. 앱 저장소 토큰은 checkout에서만 사용하고 Git 자격 증명으로 저장하지 않습니다. 별도 자동화 상태는 automation-state 브랜치의 state.json에 기록합니다. Actions 설정에서 workflow token에 read/write 권한이 허용되어야 합니다.

선택 파일 내용은 초안 생성을 위해 OpenAI API에 전송됩니다. 요청에 store: false를 지정해 Responses API의 기본 애플리케이션 상태 저장을 끄지만, OpenAI의 오용 감시 로그는 별도 정책에 따라 최대 30일 보관될 수 있습니다. 더 엄격한 보존 조건이 필요하면 키를 등록하기 전에 조직의 데이터 제어 설정을 확인합니다. 자료 범위를 넓히기 전에 허용 목록과 개인정보 영향을 다시 검토합니다.

원격 저장소와 Actions secret은 등록되어 있고, 첫 수동 실행은 모델 오류로 중단됐습니다. 기본 모델이 크레딧이 필요한 유료 ID로 넘어가면서 OpenRouter가 402(크레딧 없음)를 반환했습니다. 지금은 `:free` 모델을 기본값으로 두어 계정 크레딧 없이 실행되도록 했습니다.

### 승인 후 발행

자동 초안 PR은 Markdown diff로 검토합니다. PR preview 사이트에는 아직 초안이 표시되지 않습니다. Ready for review로 바꾸어 main에 merge하는 행위가 공개 승인입니다. merge가 끝나면 별도 workflow가 원고를 다시 검사해 published/에 검토본을 보관하고 src/content/blog/로 승격한 뒤 main에 커밋합니다. GitHub Pages workflow가 main push를 배포합니다. 저장소 branch protection이 Actions의 main push를 막으면 발행 workflow가 실패하므로, 해당 규칙을 쓰는 경우 발행 승인 방식을 조정해야 합니다. 자동화는 사람의 merge 없이 초안을 공개하지 않습니다.

## 원고 기준

- `src/content/blog/`에는 출처로 검증된 발행 가능 원고만 둡니다. 제품 코드·문서·변경 기록에서 확인할 수 없는 개인 경험은 채워 넣지 않습니다.
- SILGUM 내부 검색 수와 외부 검색량을 구분합니다. 합산 트렌드 점수를 시장 검색량이라고 표현하지 않습니다.
- 뉴스 본문이나 타인의 이미지·자료를 재배포하지 않고 출처와 원문 링크를 확인합니다.
- SILGUM 링크에는 채널 `ref`를 붙입니다. 앱 허용 목록에 있는 값만 씁니다(현재 `blog`, `blog_tistory`). 허용 목록 밖 값(`blog_dev_01` 등)은 `unknown`으로 기록되므로 넣지 않습니다.
- 공개는 자동 초안 생성만으로 이루어지지 않습니다. 사람이 검토 후 draft PR을 merge하면 재검증·승격·Pages 배포가 이어집니다.

## 티스토리 홍보글 (반자동)

티스토리 Open API가 종료되어 자동 게시는 하지 않습니다. 대신 발행된 블로그 글을 읽어 **붙여넣기용** 홍보글을 자동으로 만들고, 사람이 티스토리 에디터에 붙여 발행합니다.

1. Actions 탭에서 **Tistory promo post (manual)** workflow를 수동 실행합니다.
2. `source`에 원본 글 경로(예: `src/content/blog/my-post.md`)를, 필요하면 `original_url`에 원문 공개 URL을 넣습니다.
3. `outbox/tistory/<날짜>-<slug>.md`가 저장소에 커밋되고 artifact로도 올라옵니다. 파일의 제목·본문·태그를 복사해 티스토리에 붙여넣고 발행합니다.
4. 발행 후 그 파일의 "발행 후 기록"에 URL과 날짜를 적어 둡니다.

### 붙여넣기 도우미 (권장)

티스토리 에디터는 마크다운을 해석하지 않습니다. 그래서 생성기는 세 가지 형식을 함께 만듭니다.

- `.md` — 검토용 원본
- `.txt` — 서식 기호 없이 붙여넣기용
- `.html` — 티스토리 **HTML 모드**에 붙여넣으면 소제목·링크·코드가 서식 그대로 들어감

로컬 도우미를 쓰면 제목·본문·태그를 클립보드에 순서대로 넣고 글쓰기 페이지까지 열어 줍니다(붙여넣기와 발행 버튼은 사람이 누릅니다).

```sh
# 첫 1회: 블로그 주소를 저장소 밖 파일에 적어 둡니다(커밋되지 않음)
#   tistory.config.json  { "blog": "내블로그.tistory.com" }
npm run tistory:open
```

Enter를 두 번 누르며 제목 → 본문(HTML) → 태그 순으로 붙여넣으면 됩니다. 미리 확인만 하려면 `node scripts/tistory-open.mjs --dry-run`.

**자동 게시는 하지 않습니다.** 티스토리 Open API는 2024년 2월 종료됐고, 브라우저 자동화·매크로로 발행하는 것은 네이버/카카오 운영정책의 봇 금지 조항에 걸립니다. 그래서 이 저장소는 에디터 입력까지 자동화하지 않습니다.

로컬에서도 같은 스크립트를 씁니다.

```sh
# PowerShell: $env:SOURCE_PATH="src/content/blog/my-post.md"
OPENAI_API_KEY=<OpenRouter 키> npm run tistory
```

생성에는 무료 모델만 씁니다. 유료 모델은 계정 크레딧이 필요하므로 사용하지 않습니다. 무료 티어는 공유 풀이라 특정 모델이 429를 돌려주면 다음 무료 모델로 넘어가고, 형식이 어긋나면 최대 3회까지 교정 재요청합니다. 본문의 모든 `silgum.co.kr` 링크에는 `?ref=blog_tistory`가 자동으로 붙습니다.
