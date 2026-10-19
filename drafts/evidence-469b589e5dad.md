---
title: "실검(SILGUM) 실시간 트렌드 점수에 클릭과 가속도 보너스를 더했다"
description: "SILGUM 실시간 트렌드 점수에 클릭(관심) 보너스와 가속도 보너스가 추가되었습니다."
slug: "silgum-live-trends-views-acceleration-bonus"
heroImage: "../../assets/cards/silgum-live-trends-views-acceleration-bonus.png"
---

실검(SILGUM)의 실시간 트렌드 점수는 여러 데이터 소스의 신호를 종합해 어떤 이슈가 지금 주목받고 있는지를 보여줍니다. 이 점수는 `app/lib/trends/config.ts`에 정의된 설정 값과 `app/lib/trends/score.ts`에서 계산되며, `/api/live-trends`를 통해 외부에 공개됩니다.

## 클릭(관심) 보너스

사용자가 실제로 "왜 이게 올라와 있지?" 하고 클릭한 행위는 주목도의 중요한 지표입니다. 이제 각 이슈의 순위에 클릭 보너스가 반영됩니다. 그날 그 행을 고른 **서로 다른 브라우저 수**에 비례하며, `viewsWeight` (0.03)를 곱해 점수에 더합니다. 단, `viewsCap` (20회)까지 상한이 있어 극단적인 값이 순위를 왜곡하지 않습니다. 한 이슈에 여러 표기가 묶여 있으면 그중 가장 큰 값 하나만 씁니다.

## 가속도 보너스

한 이슈가 여러 소스에서 동시에 언급되기 시작할 때, 그 증가 속도 자체도 의미 있습니다. 가속도 보너스는 최근 2시간의 언급 증가량에서 직전 2시간의 증가량을 뺀 값에 `accelerationWeight` (0.02)를 곱해 계산합니다. 상한은 `accelerationCap` (5)입니다.

두 조건을 모두 만족할 때만 붙습니다. 서로 다른 범주에서 함께 관측되어야 하고(`observedCategories >= 2`), 그 차이가 양수여야 합니다. 즉 감소 중이거나 한 소스에서만 잡힌 이슈에는 붙지 않습니다. 화면에는 표시되지 않고 순위에만 반영됩니다.

## 범위와 제한

- 클릭 보너스는 `input.views`가 제공된 경우에만 기여하며, 없으면 영향이 없습니다.
- 가속도 보너스는 `observedCategories >= 2` 이고 가속도가 양수일 때만 적용됩니다.
- 두 보너스 모두 "참고 수준"으로 분류되며, 기본 카테고리 가중치(search 0.4, news 0.3 등)보다 낮은 영향을 미칩니다.
- 커뮤니티 글 제목은 저장되거나 표시되지 않으며, 관련 검색어 후보 추출에만 사용됩니다.

## 설정 값 요약

| 항목 | 값 |
|---|---|
| `viewsWeight` | 0.03 |
| `viewsCap` | 20 |
| `accelerationWeight` | 0.02 |
| `accelerationCap` | 5 |
| `spreadMinCategories` | 2 |
| `spreadWeight` | 0.02 |

실검에 대해 더 자세히 알려면 [실검 소개](https://silgum.co.kr/about?ref=blog)와 [실검 도구](https://silgum.co.kr/tools?ref=blog) 페이지를 참고하세요.
