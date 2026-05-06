# Python 실행 환경

제출한 코드는 브라우저 안에서 **Pyodide v0.27.3** (CPython 3.11 → WebAssembly)으로 실행됩니다.  
서버에 코드가 전송되지 않으며, 모든 채점은 사용자 브라우저에서 이루어집니다.

## 입출력

`input()`과 `print()`를 그대로 쓰면 됩니다.

```python
a, b = map(int, input().split())
print(a + b)
```

`sys.stdin`도 정상적으로 동작합니다.

```python
import sys
input = sys.stdin.readline
```

## 사용 가능한 표준 라이브러리

일반적인 알고리즘 문제에서 쓰는 모듈은 모두 동작합니다.

| 모듈 | 동작 여부 |
|------|-----------|
| `math` | ✅ |
| `collections` | ✅ |
| `heapq` | ✅ |
| `bisect` | ✅ |
| `itertools` | ✅ |
| `functools` | ✅ |
| `sys` | ✅ (일부 제한 있음, 아래 참고) |
| `re` | ✅ |
| `string` | ✅ |
| `random` | ✅ |
| `decimal`, `fractions` | ✅ |

## 제한 사항

WASM 환경이기 때문에 아래 기능은 동작하지 않습니다.

### 사용 불가

| 기능 | 이유 |
|------|------|
| `subprocess`, `os.system()` | 프로세스 생성 불가 |
| `socket`, `urllib`, `requests` | 네트워크 접근 불가 |
| `threading`, `multiprocessing` | WASM 스레드 제한 |
| 파일 읽기/쓰기 (`open()`) | 로컬 파일시스템 접근 불가 |

### 재귀 깊이

WASM 스택 크기 제한으로 인해 `sys.setrecursionlimit()`을 높게 설정해도 깊은 재귀에서 크래시가 발생할 수 있습니다.  
재귀 대신 반복문(스택 시뮬레이션)을 권장합니다.

### `sys.exit()`

`sys.exit()`를 호출하면 `SystemExit` 예외가 발생하고 런타임 에러(RE)로 처리됩니다.  
정상 종료는 코드 끝까지 실행되도록 작성하세요.

## 출력 정규화

채점 시 출력은 다음과 같이 정규화한 뒤 비교합니다.

- 각 줄 끝의 공백/탭 제거
- 마지막 빈 줄 제거

줄 끝 공백이나 마지막 개행 유무는 채점에 영향을 주지 않습니다.
