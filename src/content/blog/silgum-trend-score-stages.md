---
title: "SILGUM 실시간 트렌드 점수 산식과 공개 단계 정책"
description: "SILGUM 실시간 트렌드 점수의 범주 비중과 coldstart·growth·mature 단계별 공개 기준을 설명한다."
pubDate: "2026-10-16"
---

## 범주별 점수 구성

SILGUM 실시간 트렌드 점수는 검색, 뉴스, 검색 트렌드, 영상, 커뮤니티 다섯 범주의 값을 합산해 계산한다. 각 범주는 `app/lib/trends/config.ts`에 기록된 고정 비중을 적용하며, 비중은 0.4(검색), 0.3(뉴스), 0.2(검색 트렌드), 0.1(영상), 0.05(커뮤니티)이다. 비중은 누적 정규화되지 않는다. 범주가 누락되면 해당 비중은 점수에서 제외되고, 모든 점수는 낮게 계산된다.

각 범주의 값은 "마지막 수집 성공 시점의 신선도"에 따라 감소한다. `halfLifeHours`마다 값이 절반으로 줄어들며, `ttlHours`를 지나면 0이 된다. 예를 들어 뉴스 범주는 3시간마다 절반 감소하고 12시간이 지나면 기여하지 않는다. 검색 트렌드 범주는 1시간마다 절반 감소하고 2시간이 지나면 사라진다.

## coldstart 단계의 공개 기준

SILGUM 검색어 순위는 `docs/COLD-START.md`에 따라 단계별로 공개 기준이 달라진다. 현재 적용 중인 단계는 `coldstart`이며, 이 단계에서는 직접 입력 1건만으로도 검색어가 공개된다. 창은 48시간이며, 서로 다른 브라우저 수는 1개 이상, 직접 입력 수는 1개 이상이면 된다.

이 단계에서는 한 사람의 검색어가 그대로 노출될 수 있다. 개인정보 형태(이메일·전화·주민번호·긴 숫자·URL)와 차단어는 여전히 필터링되지만, 그 외의 단어는 공개된다. 운영자가 `/?ref=operator`로 검색한 내용은 `acquisition = "operator"`로 기록되며, 2026년 10월 13일부터 기본 가중치는 0이다. 즉 운영자 검색은 점수에 반영되지 않고 공개 기준에서도 제외된다.

## 성장과 전환 조건

`NEXT_PUBLIC_SILGUM_RANKING_STAGE` 환경 변수로 단계를 전환하며, `coldstart | growth | mature` 중 하나를 설정한다. 변수는 빌드 시점에 읽히므로 변경 시 재배포가 필요하다. API 응답에는 `policy { stage, windowHours, minDistinctSessions, minDirectSessions }`가 포함되어, 어떤 기준으로 계산되었는지를 명시한다.

coldstart → growth 전환 조건은 운영 리포트에서 7일 연속 하루 서로 다른 세션 ≥ 30이고, growth 기준으로 계산했을 때 날마다 공개 항목 ≥ 5인 때이다. growth → mature 전환은 리포트의 "검토 필요" 패턴에 자동화로 보이는 반복이 지속적으로 잡힐 때이다. 전환 시 소개 및 개인정보처리방침 문구도 단계에 맞게 자동 변경된다.

## 범위 및 제한

본 설명은 `app/lib/trends/config.ts`, `app/terms/page.tsx`, `docs/COLD-START.md`에 기반한다. SILGUM 실시간 트렌드는 외부 서비스의 전체 검색량을 의미하지 않으며, 뉴스 언급 수를 검색량으로 표시하지 않는다. 주 목록의 점수에는 외부 자료(뉴스 키워드, 검색 트렌드, 영상, 커뮤니티)도 범주별 비중으로 들어가지만, 이런 외부 자료는 `search_events`에 저장되지 않는다. 서비스별 SILGUM 검색 순위와 "브라우저 수"는 SILGUM에서 관측한 값만 사용한다.

자세한 이용약관은 [SILGUM 이용약관](https://silgum.co.kr/terms?ref=blog)을 참고하고, 서비스 소개는 [SILGUM 소개](https://silgum.co.kr/about?ref=blog) 및 [SILGUM 도구](https://silgum.co.kr/tools?ref=blog)에서 확인할 수 있다.
