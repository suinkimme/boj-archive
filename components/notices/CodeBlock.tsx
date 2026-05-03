// CodeMirror 6 기반 read-only 코드 블록.
//
// MarkdownRenderer가 next/dynamic + ssr:false로 이 파일을 import하므로 모듈
// 최상위에서 CM6 패키지를 정적 import해도 안전하다. 외부 props
// `{ code, language }`는 그대로 유지해 caller(MarkdownRenderer.pre)는 무변경.
//
// 새 언어를 추가할 때는 langExtensions()의 switch에 한 줄만 더 넣으면 된다.
// 공식 lang-* 패키지가 없는 언어는 @codemirror/legacy-modes의 stream mode를
// StreamLanguage.define으로 감싸서 쓴다 (Ruby, shell 등).

'use client'

import { StreamLanguage } from '@codemirror/language'
import { cpp } from '@codemirror/lang-cpp'
import { css } from '@codemirror/lang-css'
import { go } from '@codemirror/lang-go'
import { html } from '@codemirror/lang-html'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import type { Extension } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { useState } from 'react'

function langExtensions(lang?: string): Extension[] {
  const key = (lang ?? '').toLowerCase()
  switch (key) {
    case 'python':
    case 'py':
      return [python()]
    case 'c':
    case 'cpp':
    case 'c++':
      return [cpp()]
    case 'javascript':
    case 'js':
      return [javascript()]
    case 'jsx':
      return [javascript({ jsx: true })]
    case 'typescript':
    case 'ts':
      return [javascript({ typescript: true })]
    case 'tsx':
      return [javascript({ jsx: true, typescript: true })]
    case 'java':
      return [java()]
    case 'rust':
    case 'rs':
      return [rust()]
    case 'go':
      return [go()]
    case 'sql':
      return [sql()]
    case 'css':
    case 'scss':
      return [css()]
    case 'html':
    case 'htmlmixed':
      return [html()]
    case 'xml':
      return [xml()]
    case 'markdown':
    case 'md':
      return [markdown()]
    case 'ruby':
    case 'rb':
      return [StreamLanguage.define(ruby)]
    case 'bash':
    case 'sh':
    case 'shell':
      return [StreamLanguage.define(shell)]
    default:
      return []
  }
}

interface Props {
  code: string
  language?: string
}

export default function CodeBlock({ code, language }: Props) {
  const [copied, setCopied] = useState(false)
  const langKey = (language ?? '').toLowerCase()

  const handleCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // 권한 거부 등 — 조용히 무시
    }
  }

  return (
    <div className="relative my-8 group bg-[#212121] py-2">
      <div className="flex items-center justify-between px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">
        <span>{langKey || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="코드 복사"
          className="text-white/50 hover:text-white transition-colors"
        >
          {copied ? (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 5" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
              <rect x="4.5" y="4.5" width="8" height="9" rx="1.2" />
              <path d="M3.5 11V3.5A1 1 0 0 1 4.5 2.5H10" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
      <div className="text-[13px] leading-relaxed [&_.cm-editor]:!bg-transparent [&_.cm-gutters]:!bg-transparent [&_.cm-gutters]:!border-r-0 [&_.cm-focused]:!outline-none">
        <CodeMirror
          value={code}
          theme={oneDark}
          editable={false}
          extensions={[...langExtensions(language), EditorView.lineWrapping]}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            highlightSelectionMatches: false,
          }}
        />
      </div>
    </div>
  )
}
