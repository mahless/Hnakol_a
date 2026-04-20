import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { differenceInDays, parseISO } from 'date-fns';
import { Sunrise, Sun, Moon, AlertCircle, X, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Recipe } from '../types';
import { normalizeArabic, cn } from '../lib/utils';

export default function Dashboard() {
  const inventory = useLiveQuery(() => db.inventory.toArray());
  const recipes = useLiveQuery(() => db.recipes.toArray());

  const [selectedCategory, setSelectedCategory] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [mealSuggestions, setMealSuggestions] = useState<{ 
    recipes: Recipe[], 
    isIntegrated: boolean,
    missingIngredients: string[],
    oldMatchCount: number,
    matchPercentage: number 
  }[]>([]);
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  // When opening a category, reset to the first tab
  const openCategory = (category: 'breakfast' | 'lunch' | 'dinner') => {
    setActiveTab(0);
    handleRecommend(category);
  };

  // Calculate items nearing depletion
  const oldItems = inventory?.filter(item => {
    return item.type === 'vegetable' && differenceInDays(new Date(), parseISO(item.entryDate)) >= 5;
  }) || [];

  const handleRecommend = (category: 'breakfast' | 'lunch' | 'dinner') => {
    if (!inventory || !recipes) return;

    const catRecipes = recipes.filter(r => r.category === category);
    const invNames = inventory.map(i => ({ 
      name: normalizeArabic(i.name), 
      isOld: i.type === 'vegetable' && differenceInDays(new Date(), parseISO(i.entryDate)) >= 5 
    }));

    const checkStock = (recipe: Recipe) => {
      let matched = 0;
      let oldMatched = 0;
      const missing: string[] = [];

      recipe.ingredients.forEach(ing => {
        const ingNorm = normalizeArabic(ing);
        // Improved fuzzy matching: check if stock item is a significant part of ingredient or vice versa
        const match = invNames.find(i => {
          const invName = i.name;
          return (ingNorm.length > 2 && invName.length > 2) && (ingNorm.includes(invName) || invName.includes(ingNorm));
        });
        
        if (match) {
          matched++;
          if (match.isOld) oldMatched++;
        } else {
          missing.push(ing);
        }
      });

      return { matched, oldMatched, missing, total: recipe.ingredients.length };
    };

    let suggestions: any[] = [];

    if (category === 'lunch') {
      const integrated = catRecipes.filter(r => r.subtype === 'integrated');
      const vegetables = catRecipes.filter(r => r.subtype === 'vegetable');
      const proteins = catRecipes.filter(r => r.subtype === 'protein');
      const carbs = catRecipes.filter(r => r.subtype === 'carb');

      const addMeal = (recipesList: Recipe[]) => {
        let matched = 0, oldMatched = 0, total = 0;
        const missing: string[] = [];
        recipesList.forEach(r => {
           const stock = checkStock(r);
           matched += stock.matched;
           oldMatched += stock.oldMatched;
           total += stock.total;
           missing.push(...stock.missing);
        });
        
        const uniqueRecipes = Array.from(new Set(recipesList));

        suggestions.push({
           recipes: uniqueRecipes,
           isIntegrated: uniqueRecipes.length === 1,
           missingIngredients: Array.from(new Set(missing)),
           oldMatchCount: oldMatched,
           matchPercentage: total > 0 ? (matched / total) * 100 : 0
        });
      };

      // 1. Integrated Meals
      integrated.forEach(r => {
        if (r.title.includes('بطاطس')) {
          const vermicelli = carbs.find(c => c.title.includes('أرز بشعرية'));
          if (vermicelli) addMeal([r, vermicelli]);
          else addMeal([r]);
        } else {
          addMeal([r]);
        }
      });

      // 2. Standard Egyptian Meals (Normal Veg + Normal Protein + Normal Rice)
      const normalVegs = vegetables.filter(v => !v.title.includes('بطاطس'));
      const normalProteins = proteins.filter(p => !p.title.includes('سمك') && !p.title.includes('بانيه'));
      const normalCarbs = carbs.filter(c => !c.title.includes('صيادية') && !c.title.includes('مكرونة'));

      normalVegs.forEach(v => {
        normalProteins.forEach(p => {
          normalCarbs.forEach(c => {
            addMeal([v, c, p]);
          });
        });
      });

      // 3. Fish Meals (Fish + Sayadiya Rice ONLY - No Vegetables)
      const fishProteins = proteins.filter(p => p.title.includes('سمك'));
      const sayadiyaCarbs = carbs.filter(c => c.title.includes('صيادية'));
      fishProteins.forEach(p => {
        sayadiyaCarbs.forEach(c => {
          addMeal([p, c]);
        });
      });

      // 4. Pane Meals (Pane + Pasta ONLY)
      const paneProteins = proteins.filter(p => p.title.includes('بانيه'));
      const pastaCarbs = carbs.filter(c => c.title.includes('مكرونة'));
      paneProteins.forEach(p => {
        pastaCarbs.forEach(c => {
          addMeal([p, c]);
        });
      });

      // 5. Catch-all for Potato if it's still marked as Vegetable
      const potatoVegs = vegetables.filter(v => v.title.includes('بطاطس'));
      const vermicelliCarbs = carbs.filter(c => c.title.includes('أرز بشعرية'));
      potatoVegs.forEach(v => {
        if (vermicelliCarbs.length > 0) {
          vermicelliCarbs.forEach(c => addMeal([v, c]));
        } else {
          addMeal([v]);
        }
      });

    } else {
      // Simple suggestions for breakfast/dinner
      catRecipes.forEach(r => {
        const stock = checkStock(r);
        suggestions.push({
          recipes: [r],
          isIntegrated: true,
          missingIngredients: Array.from(new Set(stock.missing)),
          oldMatchCount: stock.oldMatched,
          matchPercentage: (stock.matched / stock.total) * 100
        });
      });
    }

    // Sort: Best match first, prioritizing old items
    suggestions.sort((a, b) => {
      if (b.oldMatchCount !== a.oldMatchCount) return b.oldMatchCount - a.oldMatchCount;
      return b.matchPercentage - a.matchPercentage;
    });

    // Only keep recipes that have at least 75% matching ingredients
    const filteredSuggestions = suggestions.filter(s => s.matchPercentage >= 75);

    setMealSuggestions(filteredSuggestions.slice(0, 2));
    setSelectedCategory(category);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    if (hour < 18) return 'مساء الخير';
    return 'مساء النور';
  };

  return (
    <div className="p-4 space-y-6">
      {/* Top Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold text-brand-terracotta">{getGreeting()}،</h2>
          <p className="text-brand-blue/80 text-lg font-semibold mt-1">جاهزين نطبخ حاجة جديدة؟</p>
        </div>

        {oldItems.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50/80 border border-brand-terracotta/20 p-4 rounded-3xl flex items-start gap-3 shadow-sm"
          >
            <AlertCircle className="w-6 h-6 text-brand-terracotta shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-brand-terracotta">مكونات قاربت على التلف!</h3>
              <p className="text-sm opacity-80 mt-1">
                عندك {oldItems.length} مكونات بقالها 5 أيام أو أكتر في المخزن ({oldItems.map(i => i.name).slice(0,3).join('، ')}{oldItems.length > 3 ? '...' : ''}). حاول تستخدمها قريب!
              </p>
            </div>
          </motion.div>
        )}
      </section>

      {/* Center Cards */}
      <section className="grid gap-4 mt-6">
        <Card 
          title="هنفطر ايه؟" 
          icon={<Sunrise className="w-8 h-8 opacity-80" />} 
          colorClass="bg-yellow-100/50 hover:bg-yellow-100/70"
          onClick={() => openCategory('breakfast')}
          delay={0.1}
        />
        <Card 
          title="هنتغدا ايه؟" 
          icon={<Sun className="w-8 h-8 opacity-80" />} 
          colorClass="bg-orange-100/50 hover:bg-orange-100/70"
          onClick={() => openCategory('lunch')}
          delay={0.2}
        />
        <Card 
          title="هنتعشا ايه؟" 
          icon={<Moon className="w-8 h-8 opacity-80" />} 
          colorClass="bg-brand-sage/20 hover:bg-brand-sage/30"
          onClick={() => openCategory('dinner')}
          delay={0.3}
        />
      </section>

      {/* Recommendation Dialog */}
      <AnimatePresence>
        {selectedCategory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 pb-safe"
            onClick={() => setSelectedCategory(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-brand-cream w-full max-w-md rounded-3xl py-6 px-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6 px-1">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <ChefHat className="w-6 h-6 text-brand-terracotta" />
                  اقتراحات الـ {selectedCategory === 'breakfast' ? 'فطار' : selectedCategory === 'lunch' ? 'غداء' : 'عشاء'}
                </h3>
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className="p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex bg-black/5 p-1 rounded-2xl mb-6">
                <button 
                  onClick={() => setActiveTab(0)}
                  className={cn("flex-1 py-2 text-sm font-bold rounded-xl transition-all", activeTab === 0 ? "bg-white shadow-sm text-brand-terracotta" : "text-brand-blue/60")}
                >
                  الوجبة الأولى
                </button>
                <button 
                  onClick={() => setActiveTab(1)}
                  className={cn("flex-1 py-2 text-sm font-bold rounded-xl transition-all", activeTab === 1 ? "bg-white shadow-sm text-brand-terracotta" : "text-brand-blue/60")}
                >
                  الوجبة الثانية
                </button>
              </div>

              <div className="space-y-0 max-h-[50vh] overflow-y-auto nice-scroll px-1">
                {!inventory || inventory.length === 0 ? (
                  <div className="text-center text-brand-blue/60 py-8 space-y-2">
                    <p className="font-bold text-lg mb-2">المخزن فاضي! 🛒</p>
                    <p className="text-sm">ضيف مكونات في <span className="font-bold">المخزن</span> الأول عشان أقدر أطابقها معاك وأقترحلك أكلات مناسبة.</p>
                  </div>
                ) : mealSuggestions.length === 0 ? (
                  <div className="text-center text-brand-blue/60 py-8 space-y-2">
                    <p className="font-bold text-lg mb-2">مفيش تطابق كافي! 🤔</p>
                    <p className="text-sm">الوصفات اللي في القسم ده محتاجة مكونات مش متوفرة بشكل كافي في المخزن (أقل من 75% تطابق).</p>
                    <p className="text-xs opacity-80 mt-2">جرب تضيف خضار أو مكونات جافة جديدة للمخزن.</p>
                  </div>
                ) : activeTab < mealSuggestions.length ? (
                  (() => {
                    const rec = mealSuggestions[activeTab];
                    return (
                      <div className="relative py-6 pr-3">
                        <div className="absolute top-6 bottom-5 right-0 w-1 bg-brand-terracotta/80 rounded-full"></div>
                        
                        <div className="space-y-1 mb-4">
                          {rec.recipes.map((r, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                               <span className="text-xs bg-brand-sage/10 text-brand-sage px-2 py-0.5 rounded-full font-bold">
                                  {r.subtype === 'vegetable' ? 'خضار' : r.subtype === 'carb' ? 'نشويات' : r.subtype === 'protein' ? 'بروتين' : 'وجبة متكاملة'}
                               </span>
                               <h4 className="text-xl font-bold">{r.title}</h4>
                            </div>
                          ))}
                        </div>

                        {rec.oldMatchCount > 0 && (
                          <div className="mb-3">
                            <span className="text-xs bg-brand-terracotta/10 text-brand-terracotta font-bold px-2 py-1 rounded-full inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              تنقذ {rec.oldMatchCount} مكون من التلف!
                            </span>
                          </div>
                        )}

                        <div className="space-y-3 mt-4">
                          {rec.missingIngredients.length > 0 ? (
                            <div className="bg-brand-yellow/10 p-3 rounded-2xl border border-brand-yellow/30">
                              <span className="text-xs font-bold text-brand-terracotta flex items-center gap-1 mb-1">
                                <AlertCircle className="w-3 h-3" />
                                ناقص من المخزن:
                              </span>
                              <p className="text-sm opacity-80 leading-relaxed">
                                {rec.missingIngredients.join('، ')}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-brand-sage/10 p-3 rounded-2xl border border-brand-sage/30">
                              <span className="text-xs font-bold text-brand-sage flex items-center gap-1">
                                ✅ كل المكونات في المخزن!
                              </span>
                            </div>
                          )}

                          <div className="bg-white/60 p-4 rounded-2xl border border-gray-100">
                            <span className="text-xs font-bold opacity-50 block mb-2 underline">المكونات المطلوبة:</span>
                            <p className="text-sm opacity-90 leading-relaxed">
                              {rec.recipes.flatMap(r => r.ingredients).join('، ')}
                            </p>
                          </div>

                          <div className="bg-white/40 p-4 rounded-2xl">
                            <span className="text-xs font-bold opacity-50 block mb-2 underline">طريقة التحضير باختصار:</span>
                            <div className="space-y-4">
                              {rec.recipes.map((r, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="font-bold text-brand-blue">{r.title}:</span>
                                  <p className="mt-1 opacity-80 leading-relaxed text-justify">{r.instructions || 'لا توجد خطوات مسجلة.'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center text-brand-blue/60 py-8">لا توجد اقتراحات أخرى.</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Card({ title, icon, colorClass, onClick, delay }: { title: string, icon: React.ReactNode, colorClass: string, onClick: () => void, delay: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.4, type: "spring" }}
      onClick={onClick}
      className={`relative overflow-hidden w-full p-6 rounded-3xl glass text-right flex items-center justify-between transition-all active:scale-95 ${colorClass}`}
    >
      <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none"></div>
      <div>
        <h3 className="text-2xl font-bold">{title}</h3>
        <p className="text-xs font-semibold opacity-70 mt-1">اضغط عشان تشوف الاقتراحات</p>
      </div>
      <div className="bg-white/40 p-3 rounded-full shadow-inner flex shrink-0">
        {icon}
      </div>
    </motion.button>
  );
}
