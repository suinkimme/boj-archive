// 편집 가능한 CodeMirror 6 인스턴스 primitive.
//
// CodeEditor.tsx에서 next/dynamic + ssr:false로 import한다 — view 계층이
// import 시점에 document를 만질 가능성이 있어 SSR에서 깨지면 안 되기 때문.
//
// C, C++는 둘 다 cpp() 모드를 쓴다 (CM6의 lang-cpp가 C 문법을 포함).

'use client'

import { cpp } from '@codemirror/lang-cpp'
import { python } from '@codemirror/lang-python'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'

import type { Lang } from './codeBoilerplate'

const EXT_BY_LANG: Record<Lang, () => Extension> = {
  python: () => python(),
  c: () => cpp(),
  cpp: () => cpp(),
}

// 사이트 화이트 톤에 맞춘 light 테마. tailwind tokens(brand-dark/text-secondary
// 등)와 동일한 헥스를 쓴다. 커서/거터/active-line만 최소 override하고
// 신택스 컬러는 @uiw/react-codemirror의 basicSetup이 끼워주는
// defaultHighlightStyle을 그대로 사용한다.
const lightTheme = EditorView.theme(
  {
    '&': {
      color: '#1C1F28',
      backgroundColor: '#FFFFFF',
    },
    '.cm-content': {
      caretColor: '#1C1F28',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", monospace',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#1C1F28' },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: '#FFE0DD',
    },
    '.cm-gutters': {
      backgroundColor: '#F5F5F5',
      color: '#9B989A',
      border: 'none',
      borderRight: '1px solid #F0F0F1',
    },
    '.cm-activeLineGutter': { backgroundColor: '#EFEFEF' },
    // 불투명 색을 칠하면 .cm-selectionLayer (z-index 낮은 layer) 가 가려져
    // 활성 줄에서 드래그 선택이 보이지 않는다. rgba 로 alpha 를 두어 선택
    // 영역이 비치게 함. CodeMirror 기본도 같은 이유로 #cceeff44 사용.
    '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.025)' },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: false },
)

interface Props {
  value: string
  language: Lang
  onChange: (value: string) => void
}

export default function CodeMirrorEditor({ value, language, onChange }: Props) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={lightTheme}
      extensions={[EXT_BY_LANG[language](), EditorView.lineWrapping]}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        // 알고리즘 푸는 맥락에서 자동완성 팝업이 빠른 타이핑을 방해해서 끔.
        // BOJ 본 IDE 와 동일하게 사용자가 직접 치는 경험.
        autocompletion: false,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true,
        history: true,
        foldGutter: false,
      }}
      indentWithTab
      height="100%"
      style={{ height: '100%', fontSize: 13 }}
      className="h-full [&_.cm-editor]:!h-full"
    />
  )
}
