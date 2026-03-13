import Image from 'next/image'
import React from 'react'
import { Titillium_Web } from 'next/font/google'

const titillium = Titillium_Web({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

function Navbar() {
  return (
    <header className="w-full bg-transparent">
      <div className="mx-auto flex max-w-8xl items-center justify-between px-2 py-4">
        <div className="flex items-center gap-3">
        <Image          
        src="/Logo1.png"
          alt="Logo"
          width={42}
          height={42}
        />
          <span className={`text-xl font-medium text-neutral-900/80 ${titillium.className}`}>
            Study Buddy
          </span>
        </div>

        <nav className="hidden items-center gap-8 text-sm font-medium text-neutral-700/70 md:flex">
          <a className="hover:text-neutral-900" href="#how-it-works">
            How it Works
          </a>
          <a className="hover:text-neutral-900" href="#features">
            Features
          </a>
          <a className="hover:text-neutral-900" href="#pricing">
            Pricing
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <a className="text-sm font-medium text-neutral-600/80 hover:text-neutral-900" href="#login">
            Login
          </a>
          <button className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:border-neutral-400 bg-green-500 hover:bg-green-600 text-white transition-colors duration-200">
            Start for Free
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar
