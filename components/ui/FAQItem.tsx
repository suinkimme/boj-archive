interface FAQItemProps {
  question: string
  answer: React.ReactNode
  isLast?: boolean
}

export function FAQItem({ question, answer, isLast = false }: FAQItemProps) {
  return (
    <details className={`py-3.5 ${!isLast ? 'border-b border-border-list' : ''}`}>
      <summary className="cursor-pointer flex items-baseline gap-2.5 text-[15px] font-semibold text-text-primary list-none">
        <span className="text-brand-red font-extrabold">Q</span>
        <span>{question}</span>
      </summary>
      <div className="flex gap-2.5 mt-2.5 text-sm text-text-secondary leading-relaxed">
        <span className="text-text-muted font-extrabold">A</span>
        <div>{answer}</div>
      </div>
    </details>
  )
}
