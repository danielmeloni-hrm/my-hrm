'use client'

import * as React from 'react'

export const ui = {
  card: 'bg-white border border-gray-200 rounded-xl shadow-sm',
  sectionTitle:
    'text-xs font-black text-[#0150a0] uppercase tracking-widest border-b border-gray-100 pb-3',
  label: 'text-[10px] font-black uppercase tracking-widest text-gray-400',
  input:
    'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition-all focus:ring-2 focus:ring-[#0150a0]/20 focus:border-[#0150a0]/30',
  select:
    'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition-all focus:ring-2 focus:ring-[#0150a0]/20 focus:border-[#0150a0]/30',
  textarea:
    'w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none resize-none transition-all focus:ring-2 focus:ring-[#0150a0]/20 focus:border-[#0150a0]/30',
}

type SectionCardProps = {
  title: string
  children: React.ReactNode
  className?: string
}

export function SectionCard({
  title,
  children,
  className = '',
}: SectionCardProps) {
  return (
    <div className={`${ui.card} p-8 space-y-8 ${className}`}>
      <h3 className={ui.sectionTitle}>{title}</h3>
      {children}
    </div>
  )
}

type SectionLabelProps = {
  children: React.ReactNode
  className?: string
}

export function SectionLabel({
  children,
  className = '',
}: SectionLabelProps) {
  return <span className={`${ui.label} ${className}`}>{children}</span>
}

type FieldBlockProps = {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function FieldBlock({
  label,
  children,
  className = '',
}: FieldBlockProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div>{label}</div>
      {children}
    </div>
  )
}

type PrimaryInputProps = React.InputHTMLAttributes<HTMLInputElement>

export function PrimaryInput({
  className = '',
  ...props
}: PrimaryInputProps) {
  return <input {...props} className={`${ui.input} ${className}`} />
}

type PrimarySelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  children: React.ReactNode
}

export function PrimarySelect({
  className = '',
  children,
  ...props
}: PrimarySelectProps) {
  return (
    <select {...props} className={`${ui.select} ${className}`}>
      {children}
    </select>
  )
}

type PrimaryTextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement>

export function PrimaryTextarea({
  className = '',
  ...props
}: PrimaryTextareaProps) {
  return <textarea {...props} className={`${ui.textarea} ${className}`} />
}