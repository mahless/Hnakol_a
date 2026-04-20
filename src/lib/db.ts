import Dexie, { type Table } from 'dexie';
import { InventoryItem, Recipe, InventoryLog } from '../types';

export class AppDatabase extends Dexie {
  inventory!: Table<InventoryItem, number>;
  recipes!: Table<Recipe, number>;
  inventoryLogs!: Table<InventoryLog, number>;

  constructor() {
    super('HanakolEhDatabase');
    this.version(3).stores({
      inventory: '++id, name, type, entryDate',
      recipes: '++id, title, category, subtype, *ingredients, isRural',
      inventoryLogs: '++id, itemName, date'
    });
  }
}

export const db = new AppDatabase();

// Pre-populate sample recipes and deduplicate
export async function initializeDatabase() {
  const seedVersion = parseInt(localStorage.getItem('hanakol_eh_seed_version') || '0');
  
  // 1. Mandatory deduplication
  const existingRecipes = await db.recipes.toArray();
  const exactTitlesSeen = new Set<string>();
  const duplicatesToDelete: number[] = [];

  for (const recipe of existingRecipes) {
    if (exactTitlesSeen.has(recipe.title)) {
      if (recipe.id) duplicatesToDelete.push(recipe.id);
    } else {
      exactTitlesSeen.add(recipe.title);
    }
  }

  if (duplicatesToDelete.length > 0) {
    await db.recipes.bulkDelete(duplicatesToDelete);
  }

  const initialRecipes: Recipe[] = [
    // --- LUNCH: INTEGRATED ---
    {
      title: 'مسقعة بلدي',
      category: 'lunch',
      subtype: 'integrated',
      ingredients: ['باذنجان رومي', 'فلفل أخضر', 'طماطم', 'ثوم', 'خل', 'صلصة طماطم', 'زيت'],
      instructions: 'قطعي الباذنجان والفلفل واقليهم. في وعاء اخر، حمري الثوم ثم ضيفي الخل وعصير الطماطم والصلصة. ضعي الباذنجان والفلفل في الصلصة واتركيهم يتسبكوا.',
    },
    {
      title: 'كشري مصري',
      category: 'lunch',
      subtype: 'integrated',
      ingredients: ['عدس بجبة', 'أرز', 'مكرونة', 'بصل', 'طماطم', 'ثوم', 'خل', 'زيت', 'شعرية'],
      instructions: 'اسلقي العدس والمكرونة. حمري الشعرية وسوي الأرز مع العدس. حمري البصل للوجه و سوي صلصة الطماطم بالثوم والخل.',
    },
    {
      title: 'مكرونة بالبشاميل',
      category: 'lunch',
      subtype: 'integrated',
      ingredients: ['مكرونة قلم', 'لحم مفروم', 'بصل', 'لبن', 'دقيق', 'سمنة', 'جبنة موتزاريلا'],
      instructions: 'عصجي اللحم بالبصل واسلقي المكرونة. حضري البشاميل من الدقيق والسمن واللبن. رصي طبقة مكرونة ثم لحم ثم مكرونة وغطيها بالبشاميل واخبزيها.',
    },
    {
      title: 'حواوشي إسكندراني',
      category: 'lunch',
      subtype: 'integrated',
      ingredients: ['لحم مفروم', 'بصل', 'فلفل أخضر', 'بقدونس', 'عجين', 'بهارات لحم'],
      instructions: 'افرمي البصل والفلفل واخلطيهم مع اللحم والبهارات. افردي العجين وضعي اللحم ثم اغلقيه واخبزيه في الفرن.',
    },
    
    // --- LUNCH: VEGETABLES ---
    {
      title: 'بامية بالصلصة',
      category: 'lunch',
      subtype: 'vegetable',
      ingredients: ['بامية', 'طماطم', 'ثوم', 'بصل', 'سمنة', 'مرقة', 'كزبرة ناشفة'],
      instructions: 'شوحي البصل والثوم وضعي عصير الطماطم لتتسبك. ضيفي البامية والمرقة، ثم اعملي طشة ثوم وكزبرة.',
    },
    {
      title: 'ملوخية خضراء',
      category: 'lunch',
      subtype: 'vegetable',
      ingredients: ['ملوخية مفرومة', 'مرقة', 'ثوم', 'كزبرة ناشفة', 'سمنة'],
      instructions: 'اغلي المرقة وضيفي الملوخية مع التقليب. حمري الثوم مع الكزبرة في السمن وطشيها على الملوخية.',
    },
    {
      title: 'صينية بطاطس بالفرن',
      category: 'lunch',
      subtype: 'integrated',
      ingredients: ['بطاطس', 'عصير طماطم', 'بصل', 'ثوم', 'دجاج', 'سمن'],
      instructions: 'قطعي البطاطس والبصل لشرائح. رصيهم في الصينية مع الثوم المهروس وعصير الطماطم والدجاج وادخليها الفرن.',
    },
    {
      title: 'قلقاس بالسلق',
      category: 'lunch',
      subtype: 'vegetable',
      ingredients: ['قلقاس', 'مرقة', 'سلق', 'كزبرة خضراء', 'ثوم', 'سمن'],
      instructions: 'اسلقي القلقاس في المرقة. حمري السلق والثوم والكزبرة واضربيهم في الخلاط ثم ضيفيهم للقلقاس.',
    },
    {
      title: 'بسلة بالجزر',
      category: 'lunch',
      subtype: 'vegetable',
      ingredients: ['بسلة', 'جزر', 'طماطم', 'بصل', 'سمنة'],
      instructions: 'شوحي البصل ثم ضعي الطماطم لتتسبك. ضيفي البسلة والجزر واتركيهم ينضجوا.',
    },

    // --- LUNCH: PROTEIN ---
    {
      title: 'لحمة محمرة',
      category: 'lunch',
      subtype: 'protein',
      ingredients: ['لحمة', 'سمنة', 'فلفل أسود'],
      instructions: 'اسلقي اللحمة جيدا ثم حمريها في السمنة وضيفي ملح وفلفل.',
    },
    {
      title: 'دجاج محمر',
      category: 'lunch',
      subtype: 'protein',
      ingredients: ['دجاج', 'سمنة', 'فلفل أسود'],
      instructions: 'اسلقي الدجاج ثم حمريه في السمنة ليأخذ لونا ذهبيا.',
    },
    {
      title: 'دجاج بانيه',
      category: 'lunch',
      subtype: 'protein',
      ingredients: ['صدور دجاج', 'بيض', 'بقسماط', 'دقيق', 'بصل', 'زيت'],
      instructions: 'تتبلي الدجاج بماء البصل. ضعيها في الدقيق ثم البيض ثم البقسماط واقليها.',
    },
    {
      title: 'كفتة مشوية',
      category: 'lunch',
      subtype: 'protein',
      ingredients: ['لحم مفروم', 'بصل', 'بقدونس', 'بهارات كفتة'],
      instructions: 'اخلطي اللحم مع تفل البصل والبهارات، صبعيها واشويها في الفرن أو على الفحم.',
    },
    {
      title: 'سمك بلطي مقلي',
      category: 'lunch',
      subtype: 'protein',
      ingredients: ['سمك بلطي', 'دقيق', 'ثوم', 'ليمون', 'كمون', 'زيت'],
      instructions: 'تبلي السمك واقليه في زيت غزير.',
    },

    // --- LUNCH: CARBS ---
    {
      title: 'أرز بشعرية',
      category: 'lunch',
      subtype: 'carb',
      ingredients: ['أرز', 'شعرية', 'سمنة', 'زيت'],
      instructions: 'حمري الشعرية ثم ضيفي الأرز والماء والملح واتركيه ينضج.',
    },
    {
      title: 'أرز أبيض',
      category: 'lunch',
      subtype: 'carb',
      ingredients: ['أرز', 'سمنة'],
      instructions: 'شوحي الأرز في السمنة وضيفي الماء والملح.',
    },
    {
      title: 'أرز صيادية (بني)',
      category: 'lunch',
      subtype: 'carb',
      ingredients: ['أرز', 'بصل', 'زيت', 'كمون'],
      instructions: 'حمري البصل حتى يصبح بنيا غامقا، ضيفي الماء ثم الأرز والكمون.',
    },
    {
      title: 'مكرونة بالصلصة الحمراء',
      category: 'lunch',
      subtype: 'carb',
      ingredients: ['مكرونة', 'طماطم', 'ثوم', 'زيت'],
      instructions: 'اسلقي المكرونة وحضري صلصة طماطم بالثوم الساخنة.',
    },

    // --- BREAKFAST ---
    {
      title: 'فول بالزيت والليمون',
      category: 'breakfast',
      subtype: 'integrated',
      ingredients: ['فول مدمس', 'ليمون', 'زيت', 'كمون'],
      instructions: 'سخني الفول وضيفي الزيت والليمون والكمون.',
    },
    {
      title: 'شكشوكة',
      category: 'breakfast',
      subtype: 'integrated',
      ingredients: ['بيض', 'طماطم', 'بصل', 'فلفل'],
      instructions: 'شوحي البصل والخضار وضيفي البيض وقلبي.',
    }
  ];

  if (seedVersion < 4) {
    const oldFlag = localStorage.getItem('hanakol_eh_seeded');
    
    if (!oldFlag || seedVersion < 4) {
      // Major update: We might want to clear or carefully update
      // For simplicity in this demo, if it's < 4, we ensure these core recipes exist
      for (const recipe of initialRecipes) {
        const exists = await db.recipes.where('title').equals(recipe.title).first();
        if (!exists) {
          await db.recipes.add(recipe);
        } else {
          // Update subtype of existing items
          await db.recipes.update(exists.id!, { subtype: recipe.subtype });
        }
      }
    }
    
    localStorage.setItem('hanakol_eh_seed_version', '4');
    localStorage.setItem('hanakol_eh_seeded', 'true');
  }
}
