// 문제 본문(raw HTML) 렌더러.
//
// `description`, `inputFormat`, `outputFormat`, `hint` 컬럼은 markdown이 아닌
// HTML이라 react-markdown을 거치지 않고 dangerouslySetInnerHTML로 직접
// 그린다. 입력 데이터는 운영자가 직접 ingestion한 신뢰 가능한 소스
// (scripts/import-problems.ts)에서 옴.
//
// 타이포는 components/notices/MarkdownRenderer.tsx와 같은 토큰을 따른다.

interface Props {
  html: string
}

export function ProblemHtml({ html }: Props) {
  return (
    <div
      className="text-text-secondary text-[15px] leading-relaxed
        [&_p]:my-3
        [&_strong]:font-bold [&_strong]:text-text-primary
        [&_em]:italic
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_ul]:space-y-1.5
        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3 [&_ol]:space-y-1.5 [&_ol]:tabular-nums
        [&_li]:leading-relaxed
        [&_a]:text-text-primary [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-brand-red
        [&_code]:bg-surface-page [&_code]:text-text-primary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:font-mono
        [&_pre]:bg-[#212121] [&_pre]:text-white [&_pre]:p-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:text-[13px] [&_pre]:font-mono
        [&_blockquote]:border-l-[3px] [&_blockquote]:border-brand-red [&_blockquote]:bg-surface-notice [&_blockquote]:px-5 [&_blockquote]:py-2.5 [&_blockquote]:my-3
        [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-[14px]
        [&_th]:text-left [&_th]:px-3 [&_th]:py-2 [&_th]:bg-surface-page [&_th]:border [&_th]:border-border-list [&_th]:text-[12px] [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-text-muted
        [&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-border-list
        [&_sup]:text-[0.75em] [&_sup]:align-super
        [&_sub]:text-[0.75em] [&_sub]:align-sub
        [&_img]:my-4 [&_img]:max-w-full"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
