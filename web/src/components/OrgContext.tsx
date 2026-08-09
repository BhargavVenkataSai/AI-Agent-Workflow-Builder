'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface OrgContextType {
  selectedOrgId: string | null;
  selectedOrgRole: string | null;
  setSelectedOrg: (id: string, role: string) => void;
}

const OrgContext = createContext<OrgContextType>({
  selectedOrgId: null,
  selectedOrgRole: null,
  setSelectedOrg: () => {},
});

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgRole, setSelectedOrgRole] = useState<string | null>(null);

  const setSelectedOrg = (id: string, role: string) => {
    setSelectedOrgId(id);
    setSelectedOrgRole(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedOrgId', id);
      localStorage.setItem('selectedOrgRole', role);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('selectedOrgId');
      const storedRole = localStorage.getItem('selectedOrgRole');
      if (storedId && storedRole) {
        setSelectedOrgId(storedId);
        setSelectedOrgRole(storedRole);
      }
    }
  }, []);

  return (
    <OrgContext.Provider value={{ selectedOrgId, selectedOrgRole, setSelectedOrg }}>
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => useContext(OrgContext);
