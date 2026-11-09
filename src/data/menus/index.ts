import type { Menu } from '../types';
import house from './house.json';

/** Menus available in the game. The real-menu import (a later milestone) will add to this. */
export const MENUS: Menu[] = [house as Menu];
export const HOUSE_MENU: Menu = MENUS[0];
