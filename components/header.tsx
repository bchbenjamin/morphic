'use client'

// import Link from 'next/link' // No longer needed directly here for Sign In button
import React, { useState } from 'react'
import { usePathname } from 'next/navigation'

import type { AppUser } from '@/lib/auth/types'
import { cn } from '@/lib/utils'

import { useSidebar } from '@/components/ui/sidebar'

import { Button } from './ui/button'
import { IconLogout, IconSettings } from '@tabler/icons-react'
import { SidebarTrigger } from './ui/sidebar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from './ui/dropdown-menu'
import { ThemeMenuItems } from './theme-menu-items'
import { FeedbackModal } from './feedback-modal'
import GuestMenu from './guest-menu' // Import the new GuestMenu component
import UserMenu from './user-menu'

interface HeaderProps {
  user: AppUser | null
  hermesOwner?: boolean
  onSignOut?: () => void
}

export const Header: React.FC<HeaderProps> = ({ user, hermesOwner = false, onSignOut }) => {
  const { open } = useSidebar()
  const pathname = usePathname()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const isRootPage = pathname === '/'

  return (
    <>
      <header
        className={cn(
          'absolute top-0 right-0 p-2 md:p-3 flex justify-between items-center z-10 backdrop-blur-sm lg:backdrop-blur-none bg-background/80 lg:bg-transparent transition-[width] duration-200 ease-linear',
          open ? 'md:w-[calc(100%-var(--sidebar-width))]' : 'md:w-full',
          'w-full'
        )}
      >
        {/* This div can be used for a logo or title on the left if needed */}
        <div>{hermesOwner && <SidebarTrigger />}</div>

        <div className="flex items-center gap-2">
          {isRootPage && !hermesOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFeedbackOpen(true)}
            >
              Feedback
            </Button>
          )}
          {hermesOwner ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-6" aria-label="Settings">
                  <IconSettings className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent><ThemeMenuItems /></DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onSignOut}><IconLogout className="size-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : user ? <UserMenu user={user} /> : <GuestMenu />}
        </div>
      </header>

      {isRootPage && !hermesOwner && (
        <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      )}
    </>
  )
}

export default Header
