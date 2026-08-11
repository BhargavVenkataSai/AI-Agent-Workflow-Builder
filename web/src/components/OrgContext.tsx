'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUserData } from '@nhost/nextjs';

interface OrgContextType {
  selectedOrgId: string | null;
  setSelectedOrg: (id: string) => void;
}

const OrgContext = createContext<OrgContextType>({
  selectedOrgId: null,
  setSelectedOrg: () => {},
});

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const user = useUserData();

  const setSelectedOrg = (id: string) => {
    setSelectedOrgId(id);
    if (typeof window !== 'undefined' && user?.id) {
      localStorage.setItem(`selectedOrg:${user.id}`, id);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id) {
      const storedId = localStorage.getItem(`selectedOrg:${user.id}`);
      if (storedId) {
        setSelectedOrgId(storedId);
      } else {
        setSelectedOrgId(null);
      }
    } else {
      setSelectedOrgId(null);
    }
  }, [user?.id]);

  return (
    <OrgContext.Provider value={{ selectedOrgId, setSelectedOrg }}>
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => useContext(OrgContext);
