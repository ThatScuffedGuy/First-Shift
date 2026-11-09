import { HOUSE_MENU } from './data/menus';
import type { Menu } from './data/types';
import { progress } from './progress';
import { settings } from './settings';

/** The house menu plus every menu you've imported. */
export const availableMenus = (): Menu[] => [HOUSE_MENU, ...progress.menus()];

/**
 * Tonight's menu. An imported menu with few drinks borrows some from the house
 * menu, so the drink station always has a few to choose from.
 */
export function currentMenu(): Menu {
  const menu = availableMenus().find((m) => m.id === settings.menuId) ?? HOUSE_MENU;
  const drinks = menu.items.filter((m) => m.category === 'drink');
  if (drinks.length >= 3) return menu;
  const names = new Set(drinks.map((d) => d.names.en?.plain.toLowerCase()));
  const extra = HOUSE_MENU.items.filter((m) => m.category === 'drink' && !names.has(m.names.en.plain.toLowerCase())).slice(0, 3 - drinks.length);
  return { ...menu, items: [...menu.items, ...extra] };
}
