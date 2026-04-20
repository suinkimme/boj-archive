# BOJ Archive

백준 온라인 저지(acmicpc.net) 서비스 종료에 따라 공익 목적으로 수집한 문제 아카이브입니다.

## 다운로드

| 파일 | 내용 | 크기 |
|------|------|------|
| [problems.tar.gz](../../releases/latest) | 전체 문제 JSON + 이미지 (33,828개) | 560MB |

```bash
tar -xzf problems.tar.gz
```

## 빠른 탐색

[`index.json`](./index.json) — 전체 문제의 메타데이터 목록 (문제 본문 제외, 9MB)

```json
[
  {
    "id": 1000,
    "title": "A+B",
    "time_limit": "2 초",
    "memory_limit": "128 MB",
    "level": 1,
    "tags": ["math", "implementation"],
    "accepted_user_count": 120000,
    "average_tries": 1.5
  },
  ...
]
```

## 폴더 구조

```
problems/
├── 1000/
│   └── problem.json
├── 1003/
│   └── problem.json
├── 13232/
│   ├── problem.json
│   └── 1.png          ← 이미지가 있는 경우 같은 폴더에 저장
└── ...
```

## 문제 JSON 스키마

`problems/{id}/problem.json` 파일 구조:

```json
{
  "id": 1003,
  "title": "피보나치 함수",
  "time_limit": "0.25 초",
  "memory_limit": "128 MB",
  "description": "<p>...</p>",
  "input": "<p>...</p>",
  "output": "<p>...</p>",
  "samples": [
    { "input": "3\n0\n1\n3\n", "output": "1 0\n0 1\n1 2\n" }
  ],
  "hint": null,
  "source": "baekjoon",
  "level": 8,
  "tags": ["dp"],
  "accepted_user_count": 70460,
  "submission_count": null,
  "average_tries": 2.86
}
```

이미지 src는 `problem.json`과 같은 폴더 기준 상대경로입니다. (예: `src="1.png"`)

### `level` 난이도 티어 (solved.ac 기준)

| 값 | 티어 |
|----|------|
| 0 | Unrated |
| 1–5 | Bronze V–I |
| 6–10 | Silver V–I |
| 11–15 | Gold V–I |
| 16–20 | Platinum V–I |
| 21–25 | Diamond V–I |
| 26–30 | Ruby V–I |

## 저작권 고지

- 각 문제의 저작권은 원 출제자 및 해당 대회 주최 기관에 있습니다.
- 이 아카이브는 비상업적 공익 목적으로만 제공됩니다.
- 원 저작권자의 요청 시 해당 문제를 삭제합니다.

## 수집 정보

- 수집 일시: 2026년 4월
- 수집 출처: acmicpc.net, solved.ac API
- 총 문제 수: 33,828개
