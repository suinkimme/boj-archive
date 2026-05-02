// CodeMirror 5 기반 read-only 코드 블록.
//
// CodeMirror 5는 import 시점에 document를 참조해 SSR에서 깨지므로
// 이 파일은 next/dynamic + ssr:false로만 import해야 한다.
//
// 운영자가 자주 쓰는 언어 mode만 정적 import. 그 외 언어는 plain text로.

'use client'

import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/material-darker.css'
import 'codemirror/mode/javascript/javascript'
import 'codemirror/mode/python/python'
import 'codemirror/mode/clike/clike'
import 'codemirror/mode/rust/rust'
import 'codemirror/mode/go/go'
import 'codemirror/mode/ruby/ruby'
import 'codemirror/mode/shell/shell'
import 'codemirror/mode/sql/sql'
import 'codemirror/mode/css/css'
import 'codemirror/mode/htmlmixed/htmlmixed'
import 'codemirror/mode/xml/xml'
import 'codemirror/mode/markdown/markdown'

import CodeMirror from 'codemirror'
import { useEffect, useRef, useState } from 'react'

type CodeMirrorMode = string | { name: string; [k: string]: unknown }

const MODE_MAP: Record<string, CodeMirrorMode> = {
  javascript: 'javascript',
  js: 'javascript',
  jsx: { name: 'javascript', jsx: true },
  typescript: { name: 'javascript', typescript: true },
  ts: { name: 'javascript', typescript: true },
  tsx: { name: 'javascript', typescript: true, jsx: true },
  python: 'python',
  py: 'python',
  c: 'text/x-csrc',
  cpp: 'text/x-c++src',
  java: 'text/x-java',
  csharp: 'text/x-csharp',
  cs: 'text/x-csharp',
  kotlin: 'text/x-kotlin',
  rust: 'rust',
  rs: 'rust',
  go: 'go',
  ruby: 'ruby',
  rb: 'ruby',
  bash: 'shell',
  sh: 'shell',
  shell: 'shell',
  sql: 'sql',
  css: 'css',
  scss: 'css',
  html: 'htmlmixed',
  xml: 'xml',
  markdown: 'markdown',
  md: 'markdown',
}

interface Props {
  code: string
  language?: string
}

export default function CodeBlock({ code, language }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [copied, setCopied] = useState(false)
  const langKey = (language ?? '').toLowerCase()
  const mode = MODE_MAP[langKey] ?? null

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.replaceChildren()
    const editor = CodeMirror(el, {
      value: code,
      readOnly: 'nocursor',
      theme: 'material-darker',
      lineNumbers: true,
      lineWrapping: true,
      mode: mode ?? undefined,
      tabSize: 2,
      indentUnit: 2,
      viewportMargin: Infinity, // 컨텐츠 높이에 맞춰 자동 확장
    })
    return () => {
      // editor.toTextArea() 는 CM이 textarea에서 만들어졌을 때만 동작.
      // div에서 만들었으므로 wrapper element를 직접 제거.
      const wrapper = editor.getWrapperElement()
      if (wrapper.parentNode === el) el.removeChild(wrapper)
    }
  }, [code, mode])

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
      <div ref={containerRef} className="text-[13px] leading-relaxed [&_.CodeMirror]:!h-auto [&_.CodeMirror]:!bg-transparent [&_.CodeMirror-gutters]:!bg-transparent [&_.CodeMirror-gutters]:!border-r-0" />
    </div>
  )
}
