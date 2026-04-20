import React, { useState, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Plus, Trash2, ChefHat, Pencil, X, AlertTriangle } from 'lucide-react';
import { Recipe } from '../types';
import { normalizeArabic } from '../lib/utils';

export default function Recipes() {
  const recipes = useLiveQuery(() => db.recipes.toArray());
  const inventory = useLiveQuery(() => db.inventory.toArray());
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'breakfast' | 'lunch' | 'dinner'>('lunch');
  const [subtype, setSubtype] = useState<'vegetable' | 'carb' | 'protein' | 'integrated'>('integrated');
  const [ingredientsInput, setIngredientsInput] = useState('');
  const [instructions, setInstructions] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const knownIngredients = useMemo(() => {
    const list = new Set<string>();
    recipes?.forEach(r => r.ingredients.forEach(ing => list.add(ing.trim())));
    inventory?.forEach(i => list.add(i.name.trim()));
    return Array.from(list).filter(Boolean);
  }, [recipes, inventory]);

  const currentSegment = useMemo(() => {
    const parts = ingredientsInput.split(/[،,]/);
    const lastPart = parts[parts.length - 1];
    return lastPart ? lastPart.trimLeft() : '';
  }, [ingredientsInput]);
  
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
    const parts = ingredientsInput.split(/[،,]/);
    parts[parts.length - 1] = " " + suggestion;
    setIngredientsInput(parts.join("،").trim() + "، ");
    textareaRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !ingredientsInput.trim()) return;

    // Duplicate detection
    const normalizedNewTitle = normalizeArabic(title, true);
    const existingRecipe = recipes?.find(r => {
      if (editingId && r.id === editingId) return false;
      const normalizedExisting = normalizeArabic(r.title, true);
      // Check if one is a subset of the other (more aggressive duplicate detection as requested)
      return normalizedExisting.includes(normalizedNewTitle) || normalizedNewTitle.includes(normalizedExisting);
    });

    if (existingRecipe && !duplicateWarning) {
      setDuplicateWarning(`يوجد وصفة مشابهة بالفعل باسم "${existingRecipe.title}". هل تريد الإضافة على أي حال؟`);
      return;
    }

    setDuplicateWarning(null);

    const ingredients = ingredientsInput
      .split(/[،,]/)
      .map(i => i.trim())
      .filter(i => i.length > 0);

    const recipeData = {
      title: title.trim(),
      category,
      subtype,
      ingredients,
      instructions: instructions.trim(),
    };

    if (editingId) {
      await db.recipes.update(editingId, recipeData);
      setEditingId(null);
    } else {
      await db.recipes.add(recipeData);
    }

    setTitle('');
    setIngredientsInput('');
    setInstructions('');
    setCategory('lunch');
  };

  const startEdit = (recipe: Recipe) => {
    if (!recipe.id) return;
    setEditingId(recipe.id);
    setTitle(recipe.title);
    setCategory(recipe.category);
    setSubtype(recipe.subtype || 'integrated');
    setIngredientsInput(recipe.ingredients.join('، '));
    setInstructions(recipe.instructions);
    setDuplicateWarning(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const potentialDuplicates = useMemo(() => {
    if (!recipes) return [];
    const dups: { a: Recipe, b: Recipe }[] = [];
    const checked = new Set<number>();

    for (let i = 0; i < recipes.length; i++) {
      for (let j = i + 1; j < recipes.length; j++) {
        const r1 = recipes[i];
        const r2 = recipes[j];
        if (!r1.id || !r2.id) continue;
        
        const n1 = normalizeArabic(r1.title, true);
        const n2 = normalizeArabic(r2.title, true);
        
        if (n1.includes(n2) || n2.includes(n1)) {
          if (!checked.has(r1.id) && !checked.has(r2.id)) {
            dups.push({ a: r1, b: r2 });
            checked.add(r1.id);
            checked.add(r2.id);
          }
        }
      }
    }
    return dups;
  }, [recipes]);

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setIngredientsInput('');
    setInstructions('');
    setCategory('lunch');
    setSubtype('integrated');
    setDuplicateWarning(null);
  };

  const handleDelete = async (id?: number) => {
    if (id) await db.recipes.delete(id);
  };

  const categoryAr = {
    breakfast: 'فطار',
    lunch: 'غداء',
    dinner: 'عشاء'
  };

  const subtypeAr = {
    vegetable: 'خضار',
    carb: 'نشويات',
    protein: 'بروتين',
    integrated: 'وجبة متكاملة'
  };

  return (
    <div className="p-4 space-y-6">
      {/* Form Section */}
      <section className="glass p-5 rounded-3xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          {editingId ? (
            <>
              <Pencil className="w-5 h-5 text-brand-terracotta" />
              تعديل الوصفة
            </>
          ) : (
            <>
              <ChefHat className="w-5 h-5 text-brand-terracotta" />
              إضافة وصفة جديدة
            </>
          )}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-semibold mb-1">اسم الأكلة</label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDuplicateWarning(null);
                }}
                onFocus={(e) => {
                  setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                }}
                placeholder="مثال: حواوشي..."
                className="w-full p-3 rounded-xl bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-brand-terracotta"
              />
            </div>
            
            <div className="col-span-1">
              <label className="block text-sm font-semibold mb-1">الوجبة</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as 'breakfast' | 'lunch' | 'dinner')}
                className="w-full p-3 rounded-xl bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-brand-terracotta"
              >
                <option value="breakfast">فطار</option>
                <option value="lunch">غداء</option>
                <option value="dinner">عشاء</option>
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-semibold mb-1">النوع</label>
              <select
                value={subtype}
                onChange={(e) => setSubtype(e.target.value as 'vegetable' | 'carb' | 'protein' | 'integrated')}
                className="w-full p-3 rounded-xl bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-brand-terracotta"
              >
                <option value="integrated">وجبة متكاملة</option>
                <option value="vegetable">خضار</option>
                <option value="carb">نشويات (رز/مكرونة)</option>
                <option value="protein">بروتين (لحم/فراخ)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">المكونات (مفصولة بفاصلة ,)</label>
            <textarea
              ref={textareaRef}
              value={ingredientsInput}
              onChange={(e) => setIngredientsInput(e.target.value)}
              onFocus={(e) => {
                setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
              }}
              placeholder="طماطم، بصل، لحم مفروم..."
              rows={2}
              className="w-full p-3 rounded-xl bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-brand-terracotta resize-none"
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {suggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSuggestionClick(sug)}
                    className="text-xs px-3 py-1.5 bg-brand-terracotta/10 text-brand-terracotta font-bold rounded-full hover:bg-brand-terracotta/20 transition-colors"
                  >
                    {sug} +
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">طريقة التحضير (اختياري)</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              onFocus={(e) => {
                setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
              }}
              placeholder="الخطوات..."
              rows={3}
              className="w-full p-3 rounded-xl bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-brand-terracotta resize-none"
            />
          </div>
          
          {duplicateWarning && (
            <div className="bg-brand-yellow/20 border border-brand-yellow p-3 rounded-xl flex items-center gap-2 text-sm text-brand-terracotta font-semibold animate-pulse">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{duplicateWarning}</span>
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-brand-terracotta text-white font-bold py-3 rounded-xl shadow-md hover:bg-opacity-90 transition-colors flex items-center justify-center gap-2"
            >
              {editingId ? (
                <>
                  <Pencil className="w-5 h-5" />
                  تحديث الوصفة
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  حفظ الوصفة
                </>
              )}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 bg-white/50 text-brand-blue font-bold py-3 rounded-xl shadow-sm hover:bg-white/70 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                إلغاء
              </button>
            )}
          </div>
        </form>
      </section>

      {/* List Section */}
      <section>
        <div className="flex justify-between items-center mb-4 px-2">
          <h2 className="text-xl font-bold">كتاب الوصفات</h2>
          {recipes && recipes.length > 0 && (
            <span className="text-xs bg-brand-blue/10 text-brand-blue px-2 py-1 rounded-full font-bold">
              {recipes.length} وصفة
            </span>
          )}
        </div>

        {potentialDuplicates.length > 0 && !editingId && (
          <div className="mb-6 bg-brand-yellow/10 border border-brand-yellow/30 p-4 rounded-3xl space-y-3">
            <div className="flex items-center gap-2 text-brand-terracotta font-bold">
              <AlertTriangle className="w-5 h-5" />
              <span>وصفات محتملة التكرار! 🧐</span>
            </div>
            <p className="text-sm opacity-80 leading-relaxed">
              لقينا وصفات اساميها قريبة جداً من بعض، الأحسن تخليها وصفة واحدة عشان الاقتراحات تكون دقيقة:
            </p>
            <ul className="space-y-2">
              {potentialDuplicates.slice(0, 3).map((dup, i) => (
                <li key={i} className="flex items-center justify-between bg-white/40 p-2 rounded-xl text-sm">
                  <span className="font-semibold">"{dup.a.title}" و "{dup.b.title}"</span>
                  <button 
                    onClick={() => handleDelete(dup.b.id)}
                    className="text-xs text-red-500 hover:underline font-bold"
                  >
                    حذف المكرر
                  </button>
                </li>
              ))}
              {potentialDuplicates.length > 3 && (
                <li className="text-xs opacity-50 text-center">وغيرهم...</li>
              )}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {recipes?.length === 0 ? (
            <div className="text-center p-8 text-brand-blue/50 glass rounded-3xl">
              لا توجد وصفات بعد.
            </div>
          ) : (
            recipes?.slice().reverse().map(recipe => (
              <div key={recipe.id} className="p-5 rounded-3xl glass space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      {recipe.title}
                    </h3>
                    <div className="flex gap-2 mt-1">
                      <div className="text-xs opacity-70 bg-white/40 px-2 py-1 rounded-md">
                        {categoryAr[recipe.category]}
                      </div>
                      <div className="text-xs opacity-70 bg-brand-sage/10 text-brand-sage px-2 py-1 rounded-md font-bold">
                        {subtypeAr[recipe.subtype || 'integrated']}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => startEdit(recipe)}
                      className="p-2 text-brand-sage hover:text-brand-sage/80 hover:bg-brand-sage/10 rounded-xl transition-colors"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(recipe.id)}
                      className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-bold opacity-80 mb-1">المكونات:</h4>
                  <div className="flex flex-wrap gap-1">
                    {recipe.ingredients.map((ing, idx) => (
                      <span key={idx} className="text-xs bg-white/50 border border-white/40 px-2 py-1 rounded-full">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>

                {recipe.instructions && (
                  <div>
                    <h4 className="text-sm font-bold opacity-80 mb-1">الطريقة:</h4>
                    <p className="text-sm leading-relaxed opacity-90">{recipe.instructions}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
