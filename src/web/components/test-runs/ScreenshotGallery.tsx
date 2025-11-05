'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ScreenshotGalleryProps {
  screenshots: string[]
  className?: string
}

export function ScreenshotGallery({ screenshots, className }: ScreenshotGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const openLightbox = (index: number) => {
    setSelectedIndex(index)
  }

  const closeLightbox = () => {
    setSelectedIndex(null)
  }

  const goToPrevious = () => {
    setSelectedIndex((prev) => 
      prev === null || prev === 0 ? screenshots.length - 1 : prev - 1
    )
  }

  const goToNext = () => {
    setSelectedIndex((prev) => 
      prev === null || prev === screenshots.length - 1 ? 0 : prev + 1
    )
  }

  if (screenshots.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        No screenshots available
      </div>
    )
  }

  return (
    <>
      <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4', className)}>
        {screenshots.map((url, index) => (
          <button
            key={index}
            onClick={() => openLightbox(index)}
            className="relative aspect-video overflow-hidden rounded-lg border bg-muted hover:border-primary transition-colors group"
          >
            <Image
              src={url}
              alt={`Screenshot ${index + 1}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            <div className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-2 py-1 rounded">
              {index + 1}/{screenshots.length}
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={selectedIndex !== null} onOpenChange={closeLightbox}>
        <DialogContent className="max-w-7xl w-full p-0">
          <div className="relative">
            <div className="relative aspect-video bg-black">
              {selectedIndex !== null && (
                <Image
                  src={screenshots[selectedIndex]!}
                  alt={`Screenshot ${selectedIndex + 1}`}
                  fill
                  className="object-contain"
                />
              )}
            </div>

            {/* Navigation */}
            {screenshots.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white"
                  onClick={goToPrevious}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white"
                  onClick={goToNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/75 text-white text-sm px-4 py-2 rounded-full">
              {selectedIndex !== null && `${selectedIndex + 1} / ${screenshots.length}`}
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/75 text-white"
              onClick={closeLightbox}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

