export enum Rating {
  OneStar = '★☆☆☆',
  TwoStars = '★★☆☆',
  ThreeStars = '★★★☆',
  FourStars = '★★★★',
  Considering = 'Considering',
  Uninterested = 'Uninterested',
  DietRestricted = 'Diet-restricted',
}

export interface NotionMeal {
  name: string
  description: string
  rating: Rating
}
