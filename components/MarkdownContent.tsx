'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'

import remarkGfm from 'remark-gfm'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 mb-2 text-lg font-bold text-[var(--rasi-text)]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-3.5 mb-1.5 text-base font-bold text-[var(--rasi-text)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1 text-sm font-semibold text-[var(--rasi-text)]">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-2 mb-1 text-xs font-semibold text-[var(--rasi-text)]">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="mb-2.5 leading-relaxed text-[var(--rasi-text)] last:mb-0">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-[var(--rasi-text)]">{children}</strong>
          ),
          em: ({ children }) => <em className="text-[var(--rasi-text)] italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-2 ml-5 list-disc space-y-1 text-[var(--rasi-text)] marker:text-[var(--rasi-muted)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-5 list-decimal space-y-1.5 text-[var(--rasi-text)] marker:font-semibold marker:text-[var(--rasi-text)]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 rounded-r-lg border-l-2 border-[var(--rasi-primary)] bg-[var(--rasi-muted-bg)]/50 px-3.5 py-2 text-xs text-[var(--rasi-muted)] italic">
              {children}
            </blockquote>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock = /language-(\w+)/.test(codeClassName || '')
            if (isBlock) {
              return (
                <div className="my-2.5 overflow-x-auto rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] p-3">
                  <pre className="font-mono text-xs text-[var(--rasi-text)]">
                    <code className={codeClassName} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              )
            }
            return (
              <code
                className="rounded border border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--rasi-primary)]"
                {...props}
              >
                {children}
              </code>
            )
          },
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-[var(--rasi-border)]">
              <table className="w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-[var(--rasi-border)] bg-[var(--rasi-muted-bg)]">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold text-[var(--rasi-text)]">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[var(--rasi-border)]/40 px-3 py-2 text-[var(--rasi-text)] last:border-0">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--rasi-primary)] underline decoration-[var(--rasi-primary)]/40 underline-offset-2 transition-colors hover:decoration-[var(--rasi-primary)]"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-[var(--rasi-border)]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
