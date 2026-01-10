const categoryMap: Record<string, string> = {
  produce: 'Produce',
  meat: 'Meat',
  dairy: 'Dairy',
  pantry: 'Pantry',
  frozen: 'Frozen',
  snacks: 'Other',
  beverages: 'Other',
  household: 'Other',
};

export function getCategorySection(category: string): string {
  const key = category.toLowerCase();
  return categoryMap[key] ?? 'Other';
}
