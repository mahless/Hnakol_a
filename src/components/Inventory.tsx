import React, { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { differenceInDays, parseISO } from 'date-fns';
import { AlertCircle, FilePlus2, Trash2, History, X as CloseIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { InventoryItem, InventoryLog } from '../types';

export default function Inventory() {
  const items = useLiveQuery(() => db.inventory.toArray());
  const recipes = useLiveQuery(() => db.recipes.toArray());
  
  const logs = useLiveQuery(() => db.inventoryLogs.orderBy('date').reverse().toArray());
  
  const [name, setName] = useState('');
  const [type, setType] = useState<'dry' | 'vegetable'>('vegetable');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('كيلو');
  const [showLogs, setShowLogs] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const knownIngredients = useMemo(() => {
    const list = new Set<string>();
    items?.forEach(i => list.add(i.name.trim()));
    recipes?.forEach(r => r.ingredients.forEach(ing => list.add(ing.trim())));
    return Array.from(list).filter(Boolean);
  }, [items, recipes]);

  const currentSegment = useMemo(() => {
    const parts = name.split(/[،,]/);
    const lastPart = parts[parts.length - 1];
    return lastPart ? lastPart.trimLeft() : '';
  }, [name]);
  
  const suggestions = useMemo(() => {
    const search = currentSegment.trim().toLowerCase();
    if (!search) return [];
    
    const matches = knownIngredients
      .filter(k => k.toLowerCase().includes(search) && k.toLowerCase() !== search);
      
    return matches.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aStarts = aLower.startsWith(search);
      const bStarts = bLower.startsWith(search);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aLower.localeCompare(bLower);
    }).slice(0, 5);
  }, [currentSegment, knownIngredients]);

  const handleSuggestionClick = (suggestion: string) => {
    const parts = name.split(/[،,]/);
    parts[parts.length - 1] = " " + suggestion;
    setName(parts.join("،").trim() + "، ");
    inputRef.current?.focus();
  };

  const sortedItems = useMemo(() => {
    if (!items) return [];
    return [...items].sort((a, b) => {
      // 1. Vegetables first, then Dry
      if (a.type !== b.type) {
        return a.type === 'vegetable' ? -1 : 1;
      }
      
      // 2. For vegetables: oldest first (to use before spoiling)
      if (a.type === 'vegetable') {
        return parseISO(a.entryDate).getTime() - parseISO(b.entryDate).getTime();
      }
      
      // 3. For dry items: newest first
      return parseISO(b.entryDate).getTime() - parseISO(a.entryDate).getTime();
    });
  }, [items]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !quantity) return;

    // Split names by Arabic or English commas, trim spaces, and remove empty ones
    const names = name.split(/[،,]/).map(n => n.trim()).filter(n => n.length > 0);
    
    if (names.length === 0) return;

    const entryDate = new Date().toISOString();
    const qty = Number(quantity);

    for (const n of names) {
      // Record in logs
      await db.inventoryLogs.add({
        itemName: n,
        quantity: qty,
        unit,
        date: entryDate
      });

      // Check if item exists in inventory
      const existing = await db.inventory.where('name').equals(n).first();
      
      if (existing && existing.id) {
        // Merge quantities and update date
        await db.inventory.update(existing.id, {
          quantity: existing.quantity + qty,
          entryDate,
          type // Ensure type matches newest entry
        });
      } else {
        // Add as new
        await db.inventory.add({
          name: n,
          type,
          quantity: qty,
          unit,
          entryDate
        });
      }
    }

    setName('');
    setQuantity('');
  };

  const handleDelete = async (id?: number) => {
    if (id) await db.inventory.delete(id);
  };

  const isOld = (item: InventoryItem) => {
    if (item.type !== 'vegetable') return false;
    const diff = differenceInDays(new Date(), parseISO(item.entryDate));
    return diff >= 5;
  };

  return (
    <div className="p-4 space-y-6">
      {/* Form Section */}
      <section className="glass p-5 rounded-3xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FilePlus2 className="w-5 h-5 text-brand-sage" />
            إضافة مشتريات جديدة
          </h2>
          <button
            onClick={() => setShowLogs(true)}
            className="flex items-center gap-1 text-sm font-bold text-brand-blue bg-white/40 px-3 py-1.5 rounded-xl hover:bg-white/60 transition-colors"
          >
            <History className="w-4 h-4" />
            السجل
          </button>
        </div>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">اسم المكون</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => {
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
              }}
              placeholder="مثال: طماطم، ثوم، بطاطس..."
              className="w-full p-3 rounded-xl bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-brand-sage transition-all"
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {suggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSuggestionClick(sug)}
                    className="text-xs px-3 py-1.5 bg-brand-sage/10 text-brand-sage font-bold rounded-full hover:bg-brand-sage/20 transition-colors"
                  >
                    {sug} +
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">النوع</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'dry' | 'vegetable')}
                className="w-full p-3 rounded-xl bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-brand-sage"
              >
                <option value="vegetable">خضراوات</option>
                <option value="dry">جاف</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="block text-sm font-semibold mb-1">الكمية</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onFocus={(e) => {
                    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                  }}
                  className="w-full p-3 rounded-xl bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-brand-sage"
                />
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-semibold mb-1">الوحدة</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  onFocus={(e) => {
                    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                  }}
                  className="w-full p-3 rounded-xl bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-brand-sage text-sm"
                />
              </div>
            </div>
          </div>
          
          <button
            type="submit"
            className="w-full bg-brand-sage text-white font-bold py-3 rounded-xl shadow-md hover:bg-opacity-90 transition-colors"
          >
            إضافة للمخزن
          </button>
        </form>
      </section>

      {/* List Section */}
      <section>
        <h2 className="text-xl font-bold mb-4 px-2">محتويات المخزن</h2>
        <div className="space-y-3">
          {sortedItems.length === 0 ? (
            <div className="text-center p-8 text-brand-blue/50 glass rounded-3xl">
              المخزن فارغ حالياً. ابدأ بإضافة المكونات!
            </div>
          ) : (
            sortedItems.map(item => {
              const old = isOld(item);
              return (
                <div 
                  key={item.id} 
                  className={cn(
                    "p-4 rounded-2xl flex items-center justify-between glass transition-colors",
                    old ? "bg-red-50/60 border-brand-terracotta/30" : ""
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg leading-tight">{item.name}</h3>
                      {old && (
                        <span className="text-xs font-bold px-2 py-1 bg-brand-terracotta/10 text-brand-terracotta rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          قارب على التلف
                        </span>
                      )}
                    </div>
                    <div className="text-sm opacity-70 mt-1 flex gap-2 items-center">
                      <span>{item.quantity} {item.unit}</span>
                      <span>•</span>
                      <span>{item.type === 'dry' ? 'جاف' : 'خضراوات'}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <span className="text-[10px] opacity-40 font-bold">
                      {new Date(item.entryDate).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-brand-blue" />
                سجل المشتريات
              </h2>
              <button 
                onClick={() => setShowLogs(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5">
              {!logs || logs.length === 0 ? (
                <div className="text-center py-10 opacity-50">السجل فارغ حالياً.</div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 rounded-2xl flex justify-between items-center border border-gray-100">
                      <div>
                        <div className="font-bold">{log.itemName}</div>
                        <div className="text-xs opacity-50">
                          {new Date(log.date).toLocaleDateString('ar-EG', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-brand-blue">
                        +{log.quantity} {log.unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-5 border-t">
              <button
                onClick={() => setShowLogs(false)}
                className="w-full bg-brand-blue text-white font-bold py-3 rounded-xl"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
