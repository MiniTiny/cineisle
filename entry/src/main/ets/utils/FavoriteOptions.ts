export interface FavoriteChoice { value: string; caption: string }

export const favoriteCategories: FavoriteChoice[] = [
  { value: '', caption: 'all' },
  { value: 'Movie', caption: 'media_movie' },
  { value: 'Series', caption: 'media_series' },
  { value: 'Episode', caption: 'media_episode' },
];
export const favoriteOrders: FavoriteChoice[] = [
  { value: 'name', caption: 'name_ascending' },
  { value: 'nameDesc', caption: 'name_descending' },
  { value: 'continue', caption: 'continue_first' },
];

export const defaultFavoriteCategory: string = '';
export const defaultFavoriteOrder: string = 'name';
