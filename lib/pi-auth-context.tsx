"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"

type PiUser = {
  uid: string
  username: string
  accessToken: string
}

type PiAuthContextType = {
  user: PiUser | null
  isLoading: boolean
  login: () => Promise<void>
  logout: () => void
}

const PiAuthContext = createContext<PiAuthContextType | undefined>(undefined)

export function PiAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PiUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if running in Pi Browser
    if (typeof window !== "undefined" && (window as any).Pi) {
    }

    // Check for existing session
    const storedUser = localStorage.getItem("pitodo-user")
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {}
    }
    setIsLoading(false)
  }, [])

  const login = async () => {
    try {
      if (typeof window === "undefined" || !(window as any).Pi) {
        const mockUser: PiUser = {
          uid: "mock-user-" + Date.now(),
          username: "PiUser" + Math.floor(Math.random() * 1000),
          accessToken: "mock-token-" + Date.now(),
        }
        setUser(mockUser)
        localStorage.setItem("pitodo-user", JSON.stringify(mockUser))
        return
      }

      const Pi = (window as any).Pi
      const scopes = ["username", "payments"]
      const authResult = await Pi.authenticate(scopes, onIncompletePaymentFound)

      const piUser: PiUser = {
        uid: authResult.user.uid,
        username: authResult.user.username,
        accessToken: authResult.accessToken,
      }

      setUser(piUser)
      localStorage.setItem("pitodo-user", JSON.stringify(piUser))
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("pitodo-user")
  }

  const onIncompletePaymentFound = (payment: any) => {}

  return <PiAuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</PiAuthContext.Provider>
}

export function usePiAuth() {
  const context = useContext(PiAuthContext)
  if (!context) {
    throw new Error("usePiAuth must be used within PiAuthProvider")
  }
  return context
}
