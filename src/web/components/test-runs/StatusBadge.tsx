import { Badge } from '@/components/ui/badge'
import { TEST_STATUS_CONFIG } from '@/lib/constants'
import { cn } from '@/lib/utils'

type TestStatus = 'pass' | 'fail' | 'error' | 'timeout'

interface StatusBadgeProps {
  status: TestStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = TEST_STATUS_CONFIG[status]
  
  return (
    <Badge
      className={cn(config.bgClass, className)}
      variant="outline"
    >
      {config.label}
    </Badge>
  )
}

