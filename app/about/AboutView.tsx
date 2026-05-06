'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, type Variants } from 'framer-motion'

import { AboutHeader } from './AboutHeader'

const TYPING_CODE = `a, b = map(int, input().split())
print(a + b)`

function TypingEditor() {
  const [shown, setShown] = useState('')
  const [done, setDone] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || startedRef.current) return
        startedRef.current = true

        let i = 0
        const tick = () => {
          if (i >= TYPING_CODE.length) {
            setDone(true)
            return
          }
          i++
          setShown(TYPING_CODE.slice(0, i))
          const prev = TYPING_CODE[i - 1]
          const delay = prev === '\n' ? 260 : 45 + Math.random() * 70
          window.setTimeout(tick, delay)
        }
        tick()
      },
      { threshold: 0.4 },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const totalLines = TYPING_CODE.split('\n').length
  const shownLines = shown.split('\n')

  return (
    <div
      ref={ref}
      className="border border-border bg-white shadow-[0_30px_80px_-20px_rgba(28,31,40,0.25)] overflow-hidden"
    >
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-border text-text-primary text-[13px] font-medium">
          Python
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <span className="bg-brand-red text-white px-4 py-2 text-[13px] font-bold">제출하기</span>
      </div>

      <div className="bg-white px-4 sm:px-6 py-6 font-mono text-[13px] sm:text-[14px] leading-7 min-h-[220px]">
        {Array.from({ length: totalLines }).map((_, i) => {
          const text = shownLines[i] ?? ''
          const isLastShownLine = i === shownLines.length - 1
          const showCursor = (!done && isLastShownLine) || (done && i === totalLines - 1)
          return (
            <div key={i} className="flex items-start">
              <span className="text-text-muted select-none w-6 sm:w-8 mr-3 sm:mr-4 text-right">
                {i + 1}
              </span>
              <span className="text-text-primary whitespace-pre">{text}</span>
              {showCursor && (
                <span
                  aria-hidden="true"
                  className="inline-block w-[2px] h-[1.05rem] sm:h-[1.15rem] bg-text-primary translate-y-[3px] ml-[1px] animate-pulse"
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-border bg-white px-4 sm:px-5 pt-3 pb-4">
        <div className="flex items-center gap-5 mb-3">
          <span className="text-text-primary text-[13px] font-bold border-b-2 border-brand-red pb-2">
            입력
          </span>
          <span className="text-text-secondary text-[13px] font-medium pb-2">실행 결과</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <div className="text-text-secondary mb-1.5">입력</div>
            <div className="bg-surface-page px-3 py-2 text-text-primary font-mono">1 2</div>
          </div>
          <div>
            <div className="text-text-secondary mb-1.5">기대 출력</div>
            <div className="bg-surface-page px-3 py-2 text-text-primary font-mono">3</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const heroContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const heroItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const sectionFade: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const gridContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

const FEATURES: { title: string; description: string; icon: React.ReactNode }[] = [
  {
    title: '문제 탐색',
    description:
      '난이도, 알고리즘 태그, 풀이 상태로 필터링하고, 정렬과 검색으로 풀고 싶은 문제를 빠르게 찾을 수 있어요.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" strokeLinecap="round" />
        <path strokeLinecap="round" d="m20 20-3.5-3.5" />
      </svg>
    ),
  },
  {
    title: '실시간 채점',
    description:
      '브라우저에서 코드를 작성하고 샘플 케이스를 즉시 실행, 7,000개 이상의 문제는 히든 케이스까지 자동 채점합니다.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m8 9-4 3 4 3M16 9l4 3-4 3M14 6l-4 12" />
      </svg>
    ),
  },
  {
    title: '풀이 기록',
    description:
      '내 제출 히스토리, 푼 문제 통계, 최근 활동을 한 곳에서 추적하며 학습 흐름을 끊김 없이 이어갈 수 있어요.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M8 15v-4m4 4V9m4 6v-7" />
      </svg>
    ),
  },
  {
    title: '풀이 연동',
    description:
      'solved.ac를 통해 풀이 정보를 자동 동기화하고, 그동안 풀어온 기록까지 NEXT JUDGE에서 함께 관리해요.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5" />
      </svg>
    ),
  },
]

const STEPS: { step: string; title: string; description: string }[] = [
  {
    step: '01',
    title: 'GitHub으로 로그인',
    description: '별도 가입 없이 GitHub 계정으로 바로 시작할 수 있어요.',
  },
  {
    step: '02',
    title: '아이디 연동',
    description: 'solved.ac 인증으로 기존 풀이 기록까지 한 번에 가져옵니다.',
  },
  {
    step: '03',
    title: '문제 풀고 채점',
    description: '브라우저에서 바로 코드 작성, 샘플 케이스를 즉시 실행하세요.',
  },
]

export function AboutView() {
  return (
    <>
      <AboutHeader />

      {/* Hero */}
      <section className="bg-white">
        <motion.div
          variants={heroContainer}
          initial="hidden"
          animate="show"
          className="max-w-[1200px] mx-auto px-6 sm:px-10 min-h-screen flex flex-col items-center justify-center text-center py-24"
        >
          <motion.h1
            variants={heroItem}
            className="text-text-primary text-5xl sm:text-7xl lg:text-[96px] font-black leading-[1.25] sm:leading-[1.2] tracking-tight"
          >
            직접 풀고,
            <br />
            직접 채점하는
            <br />
            <span className="inline-flex items-baseline">
              알고리즘 저지<span className="text-brand-red">.</span>
            </span>
          </motion.h1>
          <motion.p
            variants={heroItem}
            className="mt-8 text-text-secondary text-base sm:text-lg max-w-xl leading-relaxed break-keep"
          >
            NEXT JUDGE는 누구나 문제를 풀고, 즉시 채점받고, 풀이 흐름을 이어갈 수 있는 모두에게 열린 알고리즘 저지입니다.
          </motion.p>
          <motion.div variants={heroItem} className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-brand-dark text-white px-7 py-3.5 text-[15px] font-bold hover:opacity-90 transition-opacity"
            >
              문제 풀러 가기
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/notices"
              className="inline-flex items-center justify-center gap-2 bg-white text-text-primary border border-border px-7 py-3.5 text-[15px] font-bold hover:bg-surface-page transition-colors"
            >
              공지사항 보기
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="bg-surface-page">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <motion.div
            variants={sectionFade}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="max-w-2xl mb-14 sm:mb-20"
          >
            <p className="text-brand-red text-[13px] font-bold tracking-[0.16em] uppercase mb-4">
              Features
            </p>
            <h2 className="text-text-primary text-3xl sm:text-5xl font-black leading-[1.35] sm:leading-[1.3] tracking-tight">
              문제 풀이에 필요한
              <br />
              모든 흐름을 한 곳에서<span className="text-brand-red">.</span>
            </h2>
            <p className="mt-6 text-text-secondary text-base sm:text-lg leading-relaxed break-keep">
              탐색부터 채점, 기록, 연동까지. 필요한 기능을 가까이 두고 흐름을 끊지 않습니다.
            </p>
          </motion.div>

          <motion.div
            variants={gridContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border"
          >
            {FEATURES.map((feature) => (
              <motion.article
                key={feature.title}
                variants={sectionFade}
                className="bg-white p-8 sm:p-10 flex flex-col gap-5"
              >
                <div className="w-12 h-12 flex items-center justify-center bg-brand-dark text-white">
                  {feature.icon}
                </div>
                <h3 className="text-text-primary text-xl sm:text-2xl font-black tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-[15px] leading-relaxed break-keep">
                  {feature.description}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Editor showcase */}
      <section className="bg-white">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <motion.div
              variants={sectionFade}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              className="lg:col-span-5"
            >
              <p className="text-brand-red text-[13px] font-bold tracking-[0.16em] uppercase mb-4">
                Editor &amp; Judge
              </p>
              <h2 className="text-text-primary text-3xl sm:text-5xl font-black leading-[1.35] sm:leading-[1.3] tracking-tight">
                문제, 코드, 채점이
                <br />
                한 화면에서<span className="text-brand-red">.</span>
              </h2>
              <p className="mt-6 text-text-secondary text-base sm:text-lg leading-relaxed break-keep">
                WebAssembly 기반 인-브라우저 채점 엔진. 별도 환경 설정이나 서버 왕복 없이, 작성한 코드를 클라이언트에서 곧바로 컴파일·실행·채점합니다.
              </p>
              <ul className="mt-8 flex flex-col gap-3 text-text-primary text-[15px] font-medium">
                <li className="flex gap-2 items-start">
                  <span className="text-brand-red font-black">·</span>
                  <span>현재 Python, C, C++ 지원 — Java, Ruby 등 추가 예정</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="text-brand-red font-black">·</span>
                  <span>샘플 케이스 즉시 실행, 7,000<span className="text-brand-red">+</span> 문제 히든 케이스 자동 채점</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="text-brand-red font-black">·</span>
                  <span>제출 기록과 결과 비교를 한 클릭으로</span>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="lg:col-span-7"
            >
              <TypingEditor />
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface-page">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <motion.div
            variants={sectionFade}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="max-w-2xl mb-14 sm:mb-20"
          >
            <p className="text-brand-red text-[13px] font-bold tracking-[0.16em] uppercase mb-4">
              Get Started
            </p>
            <h2 className="text-text-primary text-3xl sm:text-5xl font-black leading-[1.35] sm:leading-[1.3] tracking-tight">
              세 단계로
              <br />
              바로 시작합니다<span className="text-brand-red">.</span>
            </h2>
          </motion.div>

          <motion.ol
            variants={gridContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 list-none"
          >
            {STEPS.map((item) => (
              <motion.li
                key={item.step}
                variants={sectionFade}
                className="flex flex-col gap-4 border-t-2 border-brand-dark pt-6"
              >
                <span className="text-brand-red text-sm font-black tracking-[0.16em]">
                  {item.step}
                </span>
                <h3 className="text-text-primary text-xl sm:text-2xl font-black tracking-tight">
                  {item.title}
                </h3>
                <p className="text-text-secondary text-[15px] leading-relaxed break-keep">
                  {item.description}
                </p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-brand-dark">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <motion.div
            variants={sectionFade}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="text-center"
          >
            <h2 className="text-white text-4xl sm:text-6xl font-black leading-[1.3] sm:leading-[1.25] tracking-tight">
              지금 바로
              <br />
              풀어볼까요<span className="text-brand-red">?</span>
            </h2>
            <p className="mt-6 text-white/60 text-base sm:text-lg max-w-md mx-auto leading-relaxed break-keep">
              GitHub 계정으로 로그인하고 첫 문제를 풀어보세요.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-brand-red text-white px-7 py-3.5 text-[15px] font-bold hover:opacity-90 transition-opacity"
              >
                문제 목록 보기
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
