export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  size: string;
  heatLevel: number; // 0 to 5
  description: string;
  longDescription: string;
  flavorNotes: string[];
  pairings: string[];
  ingredients: string[];
  image: string;
  category: 'Spicy' | 'Savory' | 'Herbal' | 'Citrus';
  tags: string[];
}

export const products: Product[] = [
  {
    id: '1',
    name: 'Smoked Jalapeño Garlic',
    slug: 'smoked-jalapeno-garlic',
    price: 8.99,
    size: '3 oz',
    heatLevel: 2,
    description: 'Savory garlic and gentle jalapeño heat with a smooth smoky finish.',
    longDescription: 'A masterclass in balance. We take slow-roasted garlic and combine it with cold-smoked jalapeños to create a finishing salt that adds depth without overwhelming the palate.',
    flavorNotes: ['Smoky', 'Garlic-forward', 'Mild Heat'],
    pairings: ['Grilled Chicken', 'Roasted Potatoes', 'Corn on the Cob', 'Popcorn'],
    ingredients: ['Sea Salt', 'Smoked Jalapeño', 'Roasted Garlic'],
    image: 'https://images.unsplash.com/photo-1594489428504-5c0c480a15fd?q=80&w=800&auto=format&fit=crop',
    category: 'Spicy',
    tags: ['Smoky', 'Savory']
  },
  {
    id: '2',
    name: 'Habanero Lime Garlic',
    slug: 'habanero-lime-garlic',
    price: 9.49,
    size: '3 oz',
    heatLevel: 3,
    description: 'Bright lime, bold garlic, and fruity habanero heat for a zesty kick.',
    longDescription: 'Zesty, bright, and unapologetically bold. The natural fruitiness of the habanero pepper is amplified by fresh lime zest, while the garlic provides a savory anchor.',
    flavorNotes: ['Citrusy', 'Fruity Heat', 'Zesty'],
    pairings: ['Fish Tacos', 'Margarita Rims', 'Grilled Shrimp', 'Fresh Mango'],
    ingredients: ['Sea Salt', 'Habanero Pepper', 'Lime Zest', 'Garlic'],
    image: 'https://images.unsplash.com/photo-1591871937573-74dbba515c4c?q=80&w=800&auto=format&fit=crop',
    category: 'Spicy',
    tags: ['Citrus', 'Bold Heat']
  },
  {
    id: '3',
    name: 'Hot Lemon Pepper',
    slug: 'hot-lemon-pepper',
    price: 8.99,
    size: '3 oz',
    heatLevel: 2,
    description: 'Classic lemon-pepper flavor with a clean citrus pop and a mild spicy edge.',
    longDescription: 'A sophisticated evolution of a kitchen staple. We use premium cracked black peppercorns, dried lemon peel, and a hint of bird\'s eye chili to elevate the profile.',
    flavorNotes: ['Bright Citrus', 'Peppery', 'Clean Heat'],
    pairings: ['Roasted Salmon', 'Asparagus', 'Grilled Wings', 'Pasta Primavera'],
    ingredients: ['Sea Salt', 'Black Pepper', 'Lemon Peel', 'Chili Flakes'],
    image: 'https://images.unsplash.com/photo-1585059895524-72359e061381?q=80&w=800&auto=format&fit=crop',
    category: 'Citrus',
    tags: ['Citrus', 'Herbal']
  },
  {
    id: '4',
    name: 'Smoky Habanero Paprika',
    slug: 'smoky-habanero-paprika',
    price: 9.49,
    size: '3 oz',
    heatLevel: 3,
    description: 'Rich smoked paprika and fruity habanero create a bold, warm finish.',
    longDescription: 'The essence of a summer barbecue captured in a jar. Rich, deep Spanish smoked paprika meets the sharp, fruity sting of habanero.',
    flavorNotes: ['Deep Smoke', 'Earthy', 'Warm Heat'],
    pairings: ['Beef Brisket', 'Pork Chops', 'Deviled Eggs', 'Roasted Nuts'],
    ingredients: ['Sea Salt', 'Smoked Paprika', 'Habanero Pepper'],
    image: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?q=80&w=800&auto=format&fit=crop',
    category: 'Spicy',
    tags: ['Smoky', 'Savory']
  },
  {
    id: '5',
    name: 'Roasted Garlic Ghost Pepper',
    slug: 'roasted-garlic-ghost-pepper',
    price: 10.49,
    size: '3 oz',
    heatLevel: 5,
    description: 'Deep roasted garlic flavor followed by a serious ghost pepper burn.',
    longDescription: 'Not for the faint of heart. We lead with the rich, caramelized notes of slow-roasted garlic before the intense, slow-building heat of the ghost pepper takes hold.',
    flavorNotes: ['Intense Heat', 'Caramelized Garlic', 'Lingering'],
    pairings: ['Chili', 'Steak', 'Spicy Noodles', 'Bloody Marys'],
    ingredients: ['Sea Salt', 'Roasted Garlic', 'Ghost Pepper'],
    image: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?q=80&w=800&auto=format&fit=crop',
    category: 'Spicy',
    tags: ['Extreme Heat', 'Savory']
  },
  {
    id: '6',
    name: 'Smoked Garlic Onion',
    slug: 'smoked-garlic-onion',
    price: 8.99,
    size: '3 oz',
    heatLevel: 0,
    description: 'Bold all-purpose flavor with smoky depth and roasted garlic notes.',
    longDescription: 'The ultimate all-rounder. This salt brings the "umami" to everything it touches. By smoking the garlic and onion before blending, we achieve a savory depth.',
    flavorNotes: ['Savory', 'Sweet Onion', 'Rich Smoke'],
    pairings: ['Burgers', 'Everything Bagels', 'Roasted Veggies', 'Steak'],
    ingredients: ['Sea Salt', 'Smoked Garlic', 'Toasted Onion'],
    image: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?q=80&w=800&auto=format&fit=crop',
    category: 'Savory',
    tags: ['Savory', 'Smoky']
  },
  {
    id: '7',
    name: 'Lemon Rosemary',
    slug: 'lemon-rosemary',
    price: 8.99,
    size: '3 oz',
    heatLevel: 0,
    description: 'Fresh lemon brightness and aromatic rosemary in an elegant finishing salt.',
    longDescription: 'A walk through a Mediterranean garden. We use fresh-dried rosemary needles and bright lemon zest to create a salt that is as aromatic as it is flavorful.',
    flavorNotes: ['Aromatic', 'Piney', 'Bright'],
    pairings: ['Focaccia', 'Roasted Lamb', 'White Fish', 'Potatoes'],
    ingredients: ['Sea Salt', 'Rosemary', 'Lemon Zest'],
    image: 'https://images.unsplash.com/photo-1608500218890-c5f149f1348e?q=80&w=800&auto=format&fit=crop',
    category: 'Herbal',
    tags: ['Herbal', 'Citrus']
  },
  {
    id: '8',
    name: 'Porcini Garlic Umami',
    slug: 'porcini-garlic-umami',
    price: 10.99,
    size: '3 oz',
    heatLevel: 0,
    description: 'Earthy porcini and savory garlic deliver rich umami depth with a gourmet feel.',
    longDescription: 'The height of culinary indulgence. Wild-harvested porcini mushrooms are ground and blended with roasted garlic to create a salt that delivers an explosion of savory umami.',
    flavorNotes: ['Earthy', 'Mushroom', 'Deep Umami'],
    pairings: ['Risotto', 'Truffle Fries', 'Steak', 'Mushroom Pasta'],
    ingredients: ['Sea Salt', 'Porcini Mushroom', 'Garlic'],
    image: 'https://images.unsplash.com/photo-1569460275615-7dc3dfc40389?q=80&w=800&auto=format&fit=crop',
    category: 'Savory',
    tags: ['Savory', 'Earthy']
  }
];

export const bundles = [
  {
    id: 'b1',
    name: 'The Starter Pack',
    price: 24.99,
    products: ['1', '3', '6'],
    description: 'Our three most versatile salts to kickstart your flavor journey.'
  },
  {
    id: 'b2',
    name: 'Heat Lovers Pack',
    price: 27.99,
    products: ['2', '4', '5'],
    description: 'For those who crave the burn. From zesty habanero to intense ghost pepper.'
  },
  {
    id: 'b3',
    name: 'The Gourmet Collection',
    price: 32.99,
    products: ['7', '8', '2'],
    description: 'Elevated flavors for the sophisticated palate. Rosemary, Porcini, and Lime.'
  }
];
