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
    '.cm-activeLine': { backgroundColor: '#FAFAFA' },
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
        autocompletion: true,
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
