// 에디터 언어 / 초기 코드 / localStorage 키 상수.
//
// 키 포맷에 v1 prefix를 둔 이유: boilerplate를 바꾸거나 에디터 옵션을 변경해
// 옛 드래프트와 호환이 깨질 때 v2로 올려 한꺼번에 무효화하기 위함.

export type Lang = 'python' | 'c' | 'cpp'

export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'python', label: 'Python' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
]

export const BOILERPLATE: Record<Lang, string> = {
  python: '',
  c: '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
}

export const draftKey = (problemId: number, lang: Lang): string =>
  `next-judge:draft:v1:${problemId}:${lang}`
