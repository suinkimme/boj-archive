# 채점 아키텍처

NEXT JUDGE의 채점 기능 설계 결정. 본 문서는 *왜* 이 그림을 골랐는지의
근거를 남긴다 — 구현 단계 체크리스트는 아니다.

## 목표

- 사용자 코드를 받아 정답 여부를 판정한다.
- 서버 측 코드 실행 인프라(런타임/샌드박스/큐)를 두지 않는다 — 운영 비용 0.
- Python / C / C++ 세 언어를 1차 지원 대상으로 한다.

## 결정: 브라우저 안에서 채점한다

코드 실행을 **사용자의 브라우저**에서 수행한다. 서버는 문제 본문과
testcases만 제공하고, 컴파일·실행·비교는 모두 클라이언트에서 일어난다.

| 언어 | 런타임 | 비고 |
|---|---|---|
| Python | Pyodide (~10MB WASM) | 레거시 자산에 통합 사례 있음 |
| C / C++ | Clang WASM (~100MB) | CDN 배포 + 브라우저 캐시로 첫 방문 1회 비용 |
| (선택) JS | Native Web Worker | 추가 다운로드 없음 |

### 왜 브라우저인가 — 대안 비교

처음에 잠시 검토했던 **로컬 CLI 채점**(사용자가 CLI 도구를 깔고
hidden testcases를 동봉 다운받아 로컬 pytest 같은 러너로 실행) 안과
비교해 결정한다.

| 항목 | 로컬 CLI | 브라우저(채택) |
|---|---|---|
| 사용자 진입 | CLI 설치 필요 | URL만 열면 됨 |
| OS 의존성 | Windows에서 C/C++ toolchain 마찰 (MinGW/WSL) | OS·아키텍처 무관 (WASM) |
| 첫 사용 비용 | npm/pip 1회 설치 | Clang WASM 1회 다운로드 |
| 반복 비용 | 무관 | 브라우저 캐시 = 0 |
| 시간 측정 | 사용자 PC 사양에 따라 변동 | 일관된 단일 환경 |
| 결과 인증 | 거짓 POST 가능 | 동일 한계 |
| 디버깅 자유도 | gdb/pdb 직접 가능 | 제한적 |

브라우저 채점의 결정적 이점은 **"클릭 → 채점"의 진입 친화성**과
**OS·아키텍처 무관성**이다. 100MB Clang WASM이라는 무게는 CDN +
브라우저 캐시 조합으로 첫 방문 1회 비용으로 한정된다 (아래 참고).

## WASM 자산 배포 — CDN

Clang WASM(~100MB)·Pyodide(~10MB) 같은 거대한 정적 자산은 **edge CDN**
을 통해 배포한다.

```
[브라우저] ←─── Edge cache (ICN/ITM/HKG…) ←─── 우리 origin
                                               (S3 / Vercel Blob /
                                                Vercel static)
```

CDN 후보:

- **CloudFront + S3** — signed URL로 만료/접근 제어, 1TB/월 무료 티어
- **Vercel Edge Network (정적 자산)** — 이미 결제 통합, 별도 IAM/계정 불필요

운영 단순성을 우선하면 Vercel을, signed URL의 만료 의미를 적극 활용하고
싶다면 CloudFront를 고른다. 둘 다 edge cache + 브라우저 캐시 이중화로
**같은 사용자의 두 번째 방문은 사실상 0초**.

자산 측 헤더 권장:

- `Cache-Control: public, max-age=31536000, immutable`
- 파일명에 콘텐츠 해시 → 무효화 걱정 없이 영구 캐시
- `WebAssembly.instantiateStreaming()` 사용 — 다운로드 중 컴파일 시작

## 테스트케이스 흐름

testcases는 우리 DB(`testcases` 테이블)에 둔다 — 이는
`scripts/import-testcases.ts`로 적재된다.

```
사용자 채점 요청 → 우리 API (인증된 세션)
              ↓
              SELECT * FROM testcases WHERE problem_id = ?
              ↓
              JSON 응답 → 브라우저 메모리
              ↓
              WASM 런타임에 케이스 루프 입력 → 출력 비교
              ↓
              세션 종료 시 케이스도 함께 폐기 (디스크 미저장)
```

### "히든"의 의미와 한계

케이스가 사용자의 디스크에 평문 파일로 떨어지지 않는다는 의미에서만
"히든"이다.

- ✓ 평범한 학습자가 무심코 답을 보는 일은 막는다
- ✗ DevTools Network 탭으로 응답을 보면 들여다볼 수 있다
- ✗ obfuscation·encryption도 의지 있는 추출자에겐 무력

진짜 비공개를 원한다면 서버 채점이 답이지만, 우리 케이스 출처가
**testcase-ac 자동 생성**(generator + correct 코드로 누구나 재현 가능)
이라 비밀성 자체의 가치가 약하다. 그래서 "편의적 보호" 수준에서 멈춘다.

## 결과 보고와 그 한계

채점 결과(AC/WA/RE/TLE)는 **참고용 학습 기록**으로만 취급한다.

- 사용자가 거짓 POST로 "AC 했음"을 만들 수 있다
- 서버 재실행 없이는 막을 방법이 없다
- 따라서 `/me`의 "내가 푼 문제" 표시는 **"공식 AC"와 시각적으로 구분**
  (예: 회색 톤 또는 별도 라벨)
- 경쟁 기능(랭킹, 점수)은 이 데이터로 굴리지 않는다

## 출력 비교 정규화

```
각 줄의 trailing whitespace 제거
파일 끝 trailing 빈 줄 제거
LF/CRLF 정규화
```

문제별 special judge가 필요한 경우는 후속 과제로 미룬다.

## 빌드 순서

1. **(완료/진행 중)** `problems` / `testcases` DB 적재 — 진실 소스 확보
2. **문제 상세 페이지** (`/problems/[id]`) — 본문·샘플 표시 + "채점하기" 버튼 placeholder
3. **Pyodide 통합** — 가장 가볍고 레거시 자산 있음. 첫 채점 흐름은 Python으로 시작
4. **Clang WASM + CDN** — wasm-clang 또는 Wasmer 기반, 별도 PR
5. **(선택) 케이스 obfuscation** — DevTools 평문 노출만 막는 수준

## 비범위 (지금은 안 함)

- 서버 측 채점/샌드박스
- 수십 ms 단위의 정확한 실행 시간 측정 (TLE 판정은 보수적으로)
- 다른 언어 지원 (Java/Rust/Go 등은 후속 과제)
- 모바일 채점 (메모리·시간 제약 대비 WASM이 무거움 — 안내만)
- 부정행위 대응 (랭킹·점수 기능을 만들지 않으므로 우선순위 낮음)
