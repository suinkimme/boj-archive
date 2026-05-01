# 채점 시스템 구현 계획

## 배경

NEXT JUDGE는 백준 온라인 저지의 공익 아카이브로, 단순 문제 열람을 넘어 실제 채점 기능을 제공하는 것을 목표로 한다.

## 현재 상태

- 33,828개 문제 데이터 보유 (`problems/{id}/problem.json`)
- 각 문제에 공개 샘플 케이스 포함 (`samples` 필드)
- 레거시 서비스에서 JSCPP(C++), Pyodide(Python) 브라우저 실행 구현됨
- **신규**: 1,700여 개 문제에 `testcases.json` 추가 (testcase-ac 기반 생성)

## 채점 방식 결정

### 코드 실행 환경

| 언어 | 실행 방법 | 비고 |
|------|----------|------|
| C / C++ | Clang → WASM (브라우저) | 첫 방문 시 ~100MB 다운로드, 이후 캐시 |
| Python | Pyodide (브라우저) | 레거시에서 이미 구현됨 |
| JavaScript | Native Web Worker | 레거시에서 이미 구현됨 |

서버 없이 브라우저에서 완전히 실행. 비용 $0.

### 채점 흐름

```
사용자 코드 제출
    │
    ▼
1단계: 저장된 testcases.json으로 채점
    - 각 케이스 입력 → 브라우저 실행 → 출력 비교 (normalize 후)
    - 실패 시 → WA + 틀린 입력/정답/내 출력 표시
    │
    ▼ (전부 통과 시)
2단계: 런타임 반례 탐색 (generator 있는 문제만)
    - generator 코드 → Clang WASM → 새 랜덤 입력 생성
    - correct 코드 → Clang WASM → 정답 출력 생성
    - 사용자 코드 → 출력과 비교
    - 반례 발견 시 → WA + 반례 표시
    - N회 통과 시 → AC
```

### 출력 비교 정규화

```
각 줄 끝 공백 제거 + 끝 빈 줄 제거
```

## 구현 순서

### 1단계: 문제 상세 페이지 (`/problems/[id]`)

- [ ] 문제 설명, 입출력 형식, 샘플 케이스 표시
- [ ] 코드 에디터 (언어 선택 포함)
- [ ] testcases.json 유무로 "채점 가능" 배지 표시

### 2단계: Clang WASM 통합

- [ ] `wasm-clang` 또는 Wasmer 기반 C/C++ 브라우저 실행 구현
- [ ] Web Worker로 메인 스레드 블로킹 방지
- [ ] 기존 JSCPP 교체

### 3단계: 채점 UI

- [ ] 제출 버튼 → 케이스별 실행 → 결과 표시 (AC / WA / TLE / RE)
- [ ] WA 시 틀린 입력/정답/내 출력 표시
- [ ] 실행 중 progress 표시

### 4단계: 런타임 반례 탐색 (선택)

- [ ] testcase-ac의 generator/correct 코드를 Clang WASM으로 실행
- [ ] 1,700여 개 문제 대상으로 반례 탐색 기능 제공

## testcases.json 생성

- 생성 스크립트: `scripts/generate-testcases.py`
- 소스: [testcase-ac](https://github.com/testcase-ac/testcase-ac) generator + correct 코드
- 문제당 50개 랜덤 케이스 + singlegen 엣지 케이스
- 커버 범위: 1,700여 개 문제 (전체의 약 5%)
- 나머지 문제는 `samples`만으로 제한적 채점

### 재생성 방법

```bash
# 전체 재생성
python3 scripts/generate-testcases.py --force

# 특정 문제만
python3 scripts/generate-testcases.py --problem 1003

# 개수 조정
python3 scripts/generate-testcases.py --count 100
```

## 미결 과제

- Clang WASM 번들 크기 최적화 (100MB → 압축/지연 로딩)
- testcases.json 미보유 문제(~95%)의 채점 품질 향상 방안
- 스페셜 저지 문제 대응 (현재 스킵)
