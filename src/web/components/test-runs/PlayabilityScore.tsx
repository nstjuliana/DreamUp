import { cn } from '@/lib/utils'

interface PlayabilityScoreProps {
  score: number | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function PlayabilityScore({ score, className, size = 'md' }: PlayabilityScoreProps) {
  if (score === null || score === undefined) {
    return (
      <span className={cn('text-muted-foreground', className)}>
        N/A
      </span>
    )
  }

  const getColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
    if (score >= 40) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  return (
    <span className={cn('font-semibold', getColor(score), sizeClasses[size], className)}>
      {score}/100
    </span>
  )
}

