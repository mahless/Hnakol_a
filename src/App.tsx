/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Home, Refrigerator, BookOpen } from 'lucide-react';
import { initializeDatabase } from './lib/db';
import { cn } from './lib/utils';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Recipes from './components/Recipes';

type Tab = 'home' | 'inventory' | 'recipes';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');

  useEffect(() => {
    initializeDatabase().catch(console.error);
  }, []);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-brand-cream pb-20">
      {/* Header */}
      <header className="px-6 py-5 bg-white/30 backdrop-blur-md border-b border-white/40 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-brand-terracotta text-center">هناكل ايه؟</h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden nice-scroll">
        {activeTab === 'home' && <Dashboard />}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'recipes' && <Recipes />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full glass rounded-t-3xl border-b-0 pb-safe z-20">
        <div className="flex justify-around items-center p-3">
          <NavItem
            icon={<Home className="w-6 h-6" />}
            label="الرئيسية"
            isActive={activeTab === 'home'}
            onClick={() => setActiveTab('home')}
          />
          <NavItem
            icon={<Refrigerator className="w-6 h-6" />}
            label="المخزن"
            isActive={activeTab === 'inventory'}
            onClick={() => setActiveTab('inventory')}
          />
          <NavItem
            icon={<BookOpen className="w-6 h-6" />}
            label="الوصفات"
            isActive={activeTab === 'recipes'}
            onClick={() => setActiveTab('recipes')}
          />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-16 p-2 rounded-2xl transition-all duration-300",
        isActive ? "text-brand-terracotta bg-white/60 shadow-sm" : "text-brand-blue/60 hover:text-brand-blue"
      )}
    >
      {icon}
      <span className="text-[10px] mt-1 font-semibold">{label}</span>
    </button>
  );
}
