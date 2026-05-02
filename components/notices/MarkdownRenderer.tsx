// Notion → markdown 결과를 사이트 디자인 토큰으로 렌더링.
//
// react-markdown의 components prop으로 각 element를 우리 타이포로 매핑한다.
// DESIGN.md의 타이포/색 토큰을 그대로 사용 — 새 색·폰트 도입 금지.

'use client'

import dynamic from 'next/dynamic'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

interface Props {
  markdown: string
}

// remark-gfm: GFM 테이블 / 체크박스 / 취소선 / 자동 링크
// rehype-raw: notion-to-md가 토글을 <details>/<summary> raw HTML로 떨어뜨리고
//   북마크 transformer도 raw HTML로 카드 markup을 출력하므로, raw-HTML 무시
//   정책을 풀어 줘야 함.
const remarkPlugins = [remarkGfm]
const rehypePlugins = [rehypeRaw]

// CodeBlock은 CodeMirror 5를 쓰는데 import 시점에 document를 참조해 SSR에서
// 깨지므로 next/dynamic + ssr:false로만 import한다.
const CodeBlock = dynamic(() => import('./CodeBlock'), { ssr: false })

export function MarkdownRenderer({ markdown }: Props) {
  return (
    <div className="font-sans text-text-primary">
      <ReactMarkdown
        components={components}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

function extractText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement(node)) {
    const props = (node as ReactElement<{ children?: ReactNode }>).props
    return extractText(props?.children)
  }
  return ''
}

const components: Components = {
  h1: (props) => (
    <h1
      className="text-[26px] sm:text-[30px] font-extrabold tracking-tight text-text-primary mt-10 mb-4"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="text-[20px] sm:text-[22px] font-bold tracking-tight text-text-primary mt-10 mb-3"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="text-[16px] sm:text-[17px] font-bold tracking-tight text-text-primary mt-8 mb-2"
      {...props}
    />
  ),
  p: (props) => (
    <p
      className="text-[15px] leading-relaxed text-text-secondary my-4"
      {...props}
    />
  ),
  a: ({ href, className, children, ...props }) => {
    // Notion bookmark transformer가 출력한 카드 형태 링크는 별도 스타일.
    if (className === 'notion-bookmark') {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="not-prose group block my-5 border border-border-list bg-surface-card hover:border-brand-red transition-colors px-4 py-3 no-underline"
          {...props}
        >
          {children}
        </a>
      )
    }
    return (
      <a
        href={href}
        className="text-text-primary underline underline-offset-4 hover:text-brand-red transition-colors"
        {...(href?.startsWith('http')
          ? { target: '_blank', rel: 'noreferrer noopener' }
          : {})}
        {...props}
      >
        {children}
      </a>
    )
  },
  span: ({ className, children, ...props }) => {
    if (className === 'notion-bookmark-title') {
      return (
        <span
          className="block text-[14px] font-bold text-text-primary group-hover:text-brand-red transition-colors truncate"
          {...props}
        >
          {children}
        </span>
      )
    }
    if (className === 'notion-bookmark-url') {
      return (
        <span
          className="mt-1 block text-[12px] text-text-muted truncate"
          {...props}
        >
          {children}
        </span>
      )
    }
    return (
      <span className={className} {...props}>
        {children}
      </span>
    )
  },
  strong: (props) => <strong className="font-bold text-text-primary" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  ul: (props) => (
    <ul
      className="list-disc pl-5 my-4 space-y-1.5 marker:text-text-primary [&_ul]:my-1 [&_ul]:space-y-1 [&_ol]:my-1 [&_ol]:space-y-1"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="list-decimal pl-5 my-4 space-y-1.5 marker:text-text-primary tabular-nums [&_ul]:my-1 [&_ul]:space-y-1 [&_ol]:my-1 [&_ol]:space-y-1"
      {...props}
    />
  ),
  li: (props) => (
    <li
      className="text-[15px] leading-relaxed text-text-secondary [&>p]:my-0"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="border-l-[3px] border-brand-red bg-surface-notice px-5 py-2.5 my-3 text-[14px] text-text-secondary leading-relaxed [&>p]:my-1.5"
      {...props}
    />
  ),
  code: ({ className, children, ...props }) => {
    // 인라인 코드만 여기서 처리. 코드 블록은 pre가 가로채서 CodeBlock 컴포넌트로 렌더.
    return (
      <code
        className={`bg-surface-page text-text-primary px-1.5 py-0.5 text-[13px] font-mono ${className ?? ''}`}
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => {
    // children은 react-markdown이 렌더한 <code> element. 거기서 언어와 텍스트를 뽑아
    // CodeMirror 기반 CodeBlock에 넘긴다.
    const codeEl = isValidElement(children)
      ? (children as ReactElement<{ className?: string; children?: ReactNode }>)
      : null
    const className = codeEl?.props?.className ?? ''
    const lang = className.match(/language-([\w-]+)/)?.[1]
    const text = extractText(codeEl?.props?.children).replace(/\n$/, '')
    return <CodeBlock code={text} language={lang} />
  },
  hr: () => <hr className="my-10 border-border" />,
  details: (props) => (
    <details
      className="group my-5 [&>*:not(summary)]:pl-7 [&[open]>*:not(summary)]:mt-2"
      {...props}
    />
  ),
  summary: ({ children, ...props }) => (
    <summary
      className="cursor-pointer text-[15px] font-bold text-text-primary list-none marker:hidden [&::-webkit-details-marker]:hidden hover:text-brand-red transition-colors flex items-center gap-2 select-none"
      {...props}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="w-5 h-5 flex-shrink-0 text-text-primary transition-transform group-open:rotate-90"
        fill="currentColor"
      >
        <path d="M6 4l4 4-4 4V4z" />
      </svg>
      <span className="flex-1">{children}</span>
    </summary>
  ),
  table: (props) => (
    <div className="my-5 overflow-x-auto border border-border-list">
      <table className="w-full text-[14px] border-collapse" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-surface-page" {...props} />,
  tr: (props) => <tr className="border-b border-border-list last:border-b-0" {...props} />,
  th: (props) => (
    <th
      className="text-left px-3 py-2 text-[12px] font-bold uppercase tracking-[0.12em] text-text-muted"
      {...props}
    />
  ),
  td: (props) => (
    <td className="px-3 py-2 text-text-secondary leading-relaxed" {...props} />
  ),
  // eslint-disable-next-line @next/next/no-img-element
  img: ({ src, alt }) => (
    // 외부 호스트(이미지 출처: Notion S3)라 next/image 대신 그냥 img.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ''} className="my-5 max-w-full" />
  ),
}
