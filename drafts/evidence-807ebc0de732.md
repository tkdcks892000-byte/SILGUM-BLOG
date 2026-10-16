---
title: "SILGUM 실시간 트렌드 점수 산식과 공개 단계 정책"
description: "실시간 트렌드 점수의 범주 비중과 신선도 감점, coldstart 단계의 공개 기준을 설명한다."
slug: "silgum-trend-score-and-publication-stages"
---

## 범주별 점수와 신선도 감점

SILGUM 실시간 트렌드 점수는 `app/lib/trends/config.ts`에 정의된 설정에서 계산된다. 각 범주는 고정된 비중(weight)을 가지며, 이 비중은 사용 가능한 범주 수에 따라 재정규화되지 않는다. 범주가 누락되면 해당 비중은 점수에서 제외되고, 모든 점수는 낮아진다.

- **SILGUM 검색**: 비중 0.4, 신선도 절반 수명 6시간, 유효 기간 48시간, 최소값(floor) 5. 단위는 “서로 다른 브라우저 수(전 서비스 합산, 공개 기준 통과)”이다.
- **뉴스**: 비중 0.3, 신선도 절반 수명 3시간, 유효 기간 12시간, 최소값 4. 단위는 “제목에 쓴 서로 다른 언론사 수(최근 6시간)”이다.
- **검색 트렌드**: 비중 0.2, 신선도 절반 수명 1시간, 유효 기간 2시간, 최소값 1000. 단위는 “Google Trends 한국 급상승 목록의 대략 검색량 구간”이다.
- **영상**: 비중 0.1, 신선도 절반 수명 6시간, 유효 기간 24시간, 최소값 3. 단위는 “YouTube 한국 인기 영상 50개 중 제목에 나온 영상 수”이다.
- **SNS·커뮤니티**: 비중 0, 연결 안 됨.

신선도는 범주의 마지막 성공적 수집 시간부터 경과한 시간에 따라 감소하며, `halfLifeHours`마다 절반씩 줄어든다. `ttlHours`를 지나면 해당 범주는 점수에 기여하지 않는다. 알 수 없는 시간은 만료된 것으로 간주된다.

## 공개 단계(coldstart, growth, mature)

SILGUM 실시간 검색어 순위는 `docs/COLD-START.md`에 따라 세 단계 중 하나의 프로필로 계산된다. 단계는 `NEXT_PUBLIC_SILGUM_RANKING_STAGE` 환경 변수로 설정되며, 변경 시 재배포가 필요하다.

| 단계 | windowHours | minDistinctSessions | minDirectSessions |
|---|---|---|---|
| coldstart (현재) | 48 | 1 | 1 |
| growth | 24 | 2 | 1 |
| mature | 24 | 3 | 2 |

- **coldstart**: 한 명이라도 직접 입력한 검색어가 공개될 수 있다. 개인정보 형태(이메일·전화·주민번호·긴 숫자·URL)와 차단어는 여전히 제외된다.
- **growth**: 서로 다른 브라우저 2개 이상에서 검색된 단어만 공개.
- **mature**: 서로 다른 브라우저 3개 이상에서 검색되고, 그중 2개 이상이 직접 입력된 단어만 공개.

API 응답에는 `policy { stage, windowHours, minDistinctSessions, minDirectSessions }`가 포함되어, 어떤 기준이 적용되었는지 명확히 알 수 있다. 화면 문구는 `describeGate()`를 통해 단계에 맞게 자동 변경된다.

## 운영자 초기 데이터와 외부 트렌드

운영자가 `/?ref=operator`로 페이지를 열면 해당 페이지 로드의 검색이 `acquisition = "operator"`로 기록된다. 2026-10-13부터 운영자 검색의 기본 가중치는 0이며, 이는 운영자 검색이 점수에 반영되지 않고 공개 기준의 브라우저 수에서도 제외된다는 것을 의미한다.

외부 트렌드(Google Trends, 뉴스 RSS, YouTube 인기 영상)는 참고 트렌드로 사용되며, `external_seed_scores` 테이블에 저장된다. 이 데이터는 SILGUM 내부 검색(`search_events`)과 분리되며, 실시간 트렌드 대시보드에 범주별로 합산되어 표시된다. 뉴스 키워드는 10분 캐시를 거쳐 `/api/live-trends` 응답에 포함되며, 별도로 저장되지 않는다.

## 범위 및 제한

이 문서는 `app/lib/trends/config.ts`, `app/terms/page.tsx`, `docs/COLD-START.md`에 기반한 정보를 요약한 것이다. 모든 수치와 정책은 해당 파일에 정의된 초기 운영 값이며, 소유자 승인 하에 변경될 수 있다. 외부 데이터 수집에 대한 추가 논의는 `docs/COLD-START.md` §3에 문서화된 조사 결과를 참조한다.

자세한 내용은 [SILGUM 이용약관](https://silgum.co.kr/terms)과 [SILGUM 소개](https://silgum.co.kr/about)를 확인할 수 있다.
