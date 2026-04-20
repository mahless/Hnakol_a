export interface InventoryItem {
  id?: number;
  name: string;
  type: 'dry' | 'vegetable';
  quantity: number;
  unit: string;
  entryDate: string; // ISO String
}

export interface InventoryLog {
  id?: number;
  itemName: string;
  quantity: number;
  unit: string;
  date: string;
}

export interface Recipe {
  id?: number;
  title: string;
  category: 'breakfast' | 'lunch' | 'dinner';
  subtype: 'vegetable' | 'carb' | 'protein' | 'integrated';
  ingredients: string[];
  instructions: string;
  isRural?: boolean;
}
