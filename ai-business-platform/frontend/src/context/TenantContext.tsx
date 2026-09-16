import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client'
import { Collection, SystemHealth, Tenant } from '../types/rag'

interface TenantContextType {
  tenants: Tenant[]
  activeTenant: Tenant | null
  collections: Collection[]
  activeCollectionId: string | null
  health: SystemHealth | null
  theme: 'dark' | 'light'
  isLoading: boolean
  setActiveTenantId: (id: string) => void
  setActiveCollectionId: (id: string | null) => void
  createNewTenant: (name: string) => Promise<Tenant>
  createNewCollection: (name: string, description?: string) => Promise<Collection>
  deleteExistingCollection: (collectionId: string) => Promise<void>
  refreshCollections: () => Promise<void>
  refreshTenants: () => Promise<void>
  toggleTheme: () => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Apply theme class to document body
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme')
    } else {
      document.body.classList.remove('light-theme')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  // Poll system health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const h = await api.getHealth()
        setHealth(h)
      } catch (err) {
        setHealth({
          status: 'offline',
          database: 'disconnected',
          embedding_model: 'offline',
          reranker_model: 'offline',
        })
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  // Load initial tenants
  const refreshTenants = async () => {
    try {
      setIsLoading(true)
      const list = await api.getTenants()
      setTenants(list)

      if (list.length > 0) {
        const savedId = localStorage.getItem('ai_platform_active_tenant')
        const found = list.find((t) => t.id === savedId) || list[0]
        setActiveTenant(found)
      } else {
        // Auto-create a default demo tenant if empty
        const defaultTenant = await api.createTenant('Acme Global Enterprises')
        setTenants([defaultTenant])
        setActiveTenant(defaultTenant)
      }
    } catch (err) {
      console.error('Failed to load tenants:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshTenants()
  }, [])

  // Refresh collections when active tenant changes
  const refreshCollections = async () => {
    if (!activeTenant) return
    try {
      const cols = await api.getCollections(activeTenant.id)
      setCollections(cols)
    } catch (err) {
      console.error('Failed to fetch collections:', err)
      setCollections([])
    }
  }

  useEffect(() => {
    if (activeTenant) {
      localStorage.setItem('ai_platform_active_tenant', activeTenant.id)
      setActiveCollectionId(null)
      refreshCollections()
    }
  }, [activeTenant])

  const setActiveTenantId = (id: string) => {
    const found = tenants.find((t) => t.id === id)
    if (found) {
      setActiveTenant(found)
    }
  }

  const createNewTenant = async (name: string): Promise<Tenant> => {
    const newT = await api.createTenant(name)
    setTenants((prev) => [...prev, newT])
    setActiveTenant(newT)
    return newT
  }

  const createNewCollection = async (
    name: string,
    description?: string
  ): Promise<Collection> => {
    if (!activeTenant) throw new Error('No active tenant selected')
    const col = await api.createCollection(activeTenant.id, name, description)
    setCollections((prev) => [col, ...prev])
    return col
  }

  const deleteExistingCollection = async (collectionId: string) => {
    if (!activeTenant) return
    await api.deleteCollection(activeTenant.id, collectionId)
    setCollections((prev) => prev.filter((c) => c.id !== collectionId))
    if (activeCollectionId === collectionId) {
      setActiveCollectionId(null)
    }
  }

  return (
    <TenantContext.Provider
      value={{
        tenants,
        activeTenant,
        collections,
        activeCollectionId,
        health,
        theme,
        isLoading,
        setActiveTenantId,
        setActiveCollectionId,
        createNewTenant,
        createNewCollection,
        deleteExistingCollection,
        refreshCollections,
        refreshTenants,
        toggleTheme,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
