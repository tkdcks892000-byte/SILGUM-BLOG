---
title: "SILGUM 실시간 트렌드 구성 요소 설명"
description: "SILGUM 실시간 트렌드 점수 계산에 사용되는 카테고리별 설정과 신선도, 가중치 규칙을 설명합니다."
slug: "silgum-realtime-trends-config"
---

SILGUM 실시간 트렌드 점수는 여러 카테고리의 신선도와 가중치를 결합해 계산됩니다. 각 카테고리는 고유한 가중치, 신선도 반영 시간, 최소 기여 수준을 가집니다.

## 카테고리별 구성 요소
SILGUM 실시간 트렌드는 검색, 뉴스, 검색 트렌드, 영상, 커뮤니티 다섯 가지 카테고리로 구성됩니다. 각 카테고리는 점수에 기여하는 비중(weight)을 가집니다. 예를 들어 SILGUM 검색은 0.4, 뉴스는 0.3, 검색 트렌드는 0.2, 영상은 0.1, 커뮤니티는 0입니다. 커뮤니티 카테고리는 연결되지 않은 상태(connected: false)로 점수에 포함되지 않습니다.

## 신선도 반영 방식
각 카테고리의 기여도는 마지막 성공적인 데이터 수집 이후 경과 시간에 따라 감소합니다. 신선도는 halfLifeHours마다 절반으로 줄어들며, ttlHours를 지나면 기여도가 0이 됩니다. 예를 들어 뉴스 카테고리는 halfLifeHours가 3시간, ttlHours가 12시간으로 설정되어 12시간 이후에는 점수에 반영되지 않습니다.

## 점수 산정 방식
최종 점수는 levelShare와 risingShare로 나뉩니다. levelShare(0.75)는 현재 수준을, risingShare(0.25)는 최근 risingHours(2시간) 동안의 증가분을 반영합니다. 상승 판정에는 risingMinSearch 또는 risingMinNewsStories 이상의 관측이 필요하며, 이는 단일 측정으로 인한 오탐을 방지하기 위한 조건입니다.

## 범위와 제한
이 설명은 app/lib/trends/config.ts에 정의된 LIVE_TRENDS_CONFIG 상수를 기반으로 하며, 실제 점수 계산 로직은 포함하지 않습니다. 커뮤니티 카테고리는 가중치가 0이므로 점산에 영향을 주지 않으며, 외부 데이터 수집은 순위 계산에 사용되지 않습니다. SILGUM 실시간 트렌드 점수는 오직 내부 검색 이벤트(search_events)를 입력으로 사용합니다. (https://silgum.co.kr/tools)
