export enum Rating {
  OneStar = '★☆☆☆',
  TwoStars = '★★☆☆',
  ThreeStars = '★★★☆',
  FourStars = '★★★★',
  Unrated = 'Unrated',
  Uninterested = 'Uninterested',
  DietRestricted = 'Diet-restricted',
}

export interface RecordedMeal {
  name: string
  description: string
  rating: Rating
}
