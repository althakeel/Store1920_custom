/**
 * Store1920 marketplace category tree (12 L1 categories, max 3 levels).
 * URL pattern: /category/{l1}/{l2?}/{l3?}
 */
export const CATEGORY_HIERARCHY = [
  {
    name: 'Electronics',
    slug: 'electronics',
    children: [
      {
        name: 'Mobile & Smartphones',
        slug: 'mobile-smartphones',
        children: [
          { name: 'Smartphones', slug: 'smartphones' },
          { name: 'Tablets', slug: 'tablets' },
          { name: 'Mobile Accessories', slug: 'mobile-accessories' },
          { name: 'Smartwatches & Wearables', slug: 'smartwatches-wearables' },
        ],
      },
      {
        name: 'Computers & Laptops',
        slug: 'computers-laptops',
        children: [
          { name: 'Laptops & Notebooks', slug: 'laptops-notebooks' },
          { name: 'Desktops & Monitors', slug: 'desktops-monitors' },
          { name: 'Computer Accessories', slug: 'computer-accessories' },
          { name: 'Cables & Connectivity', slug: 'cables-connectivity' },
        ],
      },
      {
        name: 'TVs & Home Entertainment',
        slug: 'tvs-home-entertainment',
        children: [
          { name: 'Televisions', slug: 'televisions' },
          { name: 'Home Theatre & Soundbars', slug: 'home-theatre-soundbars' },
          { name: 'Streaming Devices', slug: 'streaming-devices' },
        ],
      },
      {
        name: 'Audio & Headphones',
        slug: 'audio-headphones',
        children: [
          { name: 'Headphones & Earbuds', slug: 'headphones-earbuds' },
          { name: 'Speakers', slug: 'speakers' },
          { name: 'Microphones', slug: 'microphones' },
        ],
      },
      {
        name: 'Cameras & Photography',
        slug: 'cameras-photography',
        children: [
          { name: 'Cameras', slug: 'cameras' },
          { name: 'Camera Lenses', slug: 'camera-lenses' },
          { name: 'Camera Accessories', slug: 'camera-accessories' },
        ],
      },
      {
        name: 'Gaming',
        slug: 'gaming',
        children: [
          { name: 'Gaming Consoles', slug: 'gaming-consoles' },
          { name: 'Gaming Accessories', slug: 'gaming-accessories' },
          { name: 'PC Gaming', slug: 'pc-gaming' },
        ],
      },
      {
        name: 'Power & Energy',
        slug: 'power-energy',
        children: [
          { name: 'Power Banks & Chargers', slug: 'power-banks-chargers' },
          { name: 'Batteries', slug: 'batteries' },
          { name: 'UPS & Surge Protectors', slug: 'ups-surge-protectors' },
        ],
      },
      {
        name: 'Smart Home & Security',
        slug: 'smart-home-security',
        children: [
          { name: 'Security Cameras', slug: 'security-cameras' },
          { name: 'Smart Home Devices', slug: 'smart-home-devices' },
          { name: 'Doorbells & Locks', slug: 'doorbells-locks' },
        ],
      },
    ],
  },
  {
    name: 'Clothing & Fashion',
    slug: 'clothing-fashion',
    children: [
      {
        name: "Women's Clothing",
        slug: 'womens-clothing',
        children: [
          { name: 'Dresses & Abayas', slug: 'dresses-abayas' },
          { name: 'Tops & Blouses', slug: 'tops-blouses' },
          { name: 'Lingerie & Loungewear', slug: 'lingerie-loungewear' },
          { name: 'Activewear', slug: 'womens-activewear' },
        ],
      },
      {
        name: "Men's Clothing",
        slug: 'mens-clothing',
        children: [
          { name: 'Shirts & Kanduras', slug: 'shirts-kanduras' },
          { name: 'Suits & Formal Wear', slug: 'suits-formal-wear' },
          { name: 'Trousers & Jeans', slug: 'trousers-jeans' },
          { name: 'Activewear', slug: 'mens-activewear' },
        ],
      },
      {
        name: "Kids' Clothing",
        slug: 'kids-clothing',
        children: [
          { name: 'Boys Clothing', slug: 'boys-clothing' },
          { name: 'Girls Clothing', slug: 'girls-clothing' },
          { name: 'School Uniforms', slug: 'school-uniforms' },
        ],
      },
      {
        name: 'Shoes & Footwear',
        slug: 'shoes-footwear',
        children: [
          { name: 'Sneakers & Athletic Shoes', slug: 'sneakers-athletic-shoes' },
          { name: 'Heels & Dress Shoes', slug: 'heels-dress-shoes' },
          { name: 'Sandals & Slippers', slug: 'sandals-slippers' },
        ],
      },
      {
        name: 'Bags & Accessories',
        slug: 'bags-accessories',
        children: [
          { name: 'Handbags & Purses', slug: 'handbags-purses' },
          { name: 'Wallets & Belts', slug: 'wallets-belts' },
          { name: 'Sunglasses & Eyewear', slug: 'sunglasses-eyewear' },
        ],
      },
      {
        name: 'Costumes & Special Occasion',
        slug: 'costumes-special-occasion',
        children: [
          { name: 'Party Costumes', slug: 'party-costumes' },
          { name: 'Traditional Wear', slug: 'traditional-wear' },
        ],
      },
      {
        name: 'Watches & Jewelry',
        slug: 'watches-jewelry',
        children: [
          { name: 'Watches', slug: 'watches' },
          { name: 'Jewelry', slug: 'jewelry' },
        ],
      },
    ],
  },
  {
    name: 'Home & Living',
    slug: 'home-living',
    children: [
      {
        name: 'Furniture',
        slug: 'furniture',
        children: [
          { name: 'Sofas & Seating', slug: 'sofas-seating' },
          { name: 'Beds & Mattresses', slug: 'beds-mattresses' },
          { name: 'Wardrobes & Storage', slug: 'wardrobes-storage' },
          { name: 'Tables & Desks', slug: 'tables-desks' },
        ],
      },
      {
        name: 'Kitchen & Dining',
        slug: 'kitchen-dining',
        children: [
          { name: 'Cookware & Bakeware', slug: 'cookware-bakeware' },
          { name: 'Coffee & Tea', slug: 'coffee-tea' },
          { name: 'Kitchen Tools & Gadgets', slug: 'kitchen-tools-gadgets' },
          { name: 'Dinnerware & Serveware', slug: 'dinnerware-serveware' },
        ],
      },
      {
        name: 'Bedding & Bath',
        slug: 'bedding-bath',
        children: [
          { name: 'Bedding & Linens', slug: 'bedding-linens' },
          { name: 'Bathroom Accessories', slug: 'bathroom-accessories' },
          { name: 'Towels & Mats', slug: 'towels-mats' },
        ],
      },
      {
        name: 'Home Appliances',
        slug: 'home-appliances',
        children: [
          { name: 'Large Appliances', slug: 'large-appliances' },
          { name: 'Small Appliances', slug: 'small-appliances' },
          { name: 'Kitchen Appliances', slug: 'kitchen-appliances' },
        ],
      },
      {
        name: 'Home Décor',
        slug: 'home-decor',
        children: [
          { name: 'Wall Art & Mirrors', slug: 'wall-art-mirrors' },
          { name: 'Lighting & Lamps', slug: 'lighting-lamps' },
          { name: 'Rugs & Curtains', slug: 'rugs-curtains' },
        ],
      },
      {
        name: 'Storage & Organization',
        slug: 'storage-organization',
        children: [
          { name: 'Closet & Wardrobe Organizers', slug: 'closet-wardrobe-organizers' },
          { name: 'Shelving & Racks', slug: 'shelving-racks' },
        ],
      },
    ],
  },
  {
    name: 'Health, Beauty & Personal Care',
    slug: 'health-beauty-personal-care',
    children: [
      {
        name: 'Makeup & Cosmetics',
        slug: 'makeup-cosmetics',
        children: [
          { name: 'Face Makeup', slug: 'face-makeup' },
          { name: 'Eye Makeup', slug: 'eye-makeup' },
          { name: 'Lip Makeup', slug: 'lip-makeup' },
        ],
      },
      {
        name: 'Skincare',
        slug: 'skincare',
        children: [
          { name: 'Moisturizers & Serums', slug: 'moisturizers-serums' },
          { name: 'Cleansers & Toners', slug: 'cleansers-toners' },
          { name: 'Sunscreen', slug: 'sunscreen' },
        ],
      },
      {
        name: 'Hair Care',
        slug: 'hair-care',
        children: [
          { name: 'Shampoo & Conditioner', slug: 'shampoo-conditioner' },
          { name: 'Styling Tools', slug: 'hair-styling-tools' },
        ],
      },
      {
        name: 'Fragrance & Perfumes',
        slug: 'fragrance-perfumes',
        children: [
          { name: 'Perfumes & EDP', slug: 'perfumes-edp' },
          { name: 'Oud & Arabian Fragrance', slug: 'oud-arabian-fragrance' },
          { name: 'Body Mists', slug: 'body-mists' },
        ],
      },
      {
        name: 'Personal Care & Hygiene',
        slug: 'personal-care-hygiene',
        children: [
          { name: 'Oral Care', slug: 'oral-care' },
          { name: 'Bath & Body', slug: 'bath-body' },
          { name: 'Shaving & Grooming', slug: 'shaving-grooming' },
        ],
      },
      {
        name: 'Health & Wellness',
        slug: 'health-wellness',
        children: [
          { name: 'Vitamins & Supplements', slug: 'vitamins-supplements' },
          { name: 'Medical Supplies', slug: 'medical-supplies' },
          { name: 'Massage & Relaxation', slug: 'massage-relaxation' },
        ],
      },
    ],
  },
  {
    name: 'Baby, Kids & Maternity',
    slug: 'baby-kids-maternity',
    children: [
      {
        name: 'Baby Essentials',
        slug: 'baby-essentials',
        children: [
          { name: 'Nappies & Wipes', slug: 'nappies-wipes' },
          { name: 'Baby Feeding', slug: 'baby-feeding' },
          { name: 'Baby Care & Bath', slug: 'baby-care-bath' },
        ],
      },
      {
        name: 'Toys, Games & Education',
        slug: 'toys-games-education',
        children: [
          { name: 'Educational Toys', slug: 'educational-toys' },
          { name: 'Action Figures & Dolls', slug: 'action-figures-dolls' },
          { name: 'Board Games & Puzzles', slug: 'board-games-puzzles' },
        ],
      },
      {
        name: 'Kids Furniture & Nursery',
        slug: 'kids-furniture-nursery',
        children: [
          { name: 'Cribs & Beds', slug: 'cribs-beds' },
          { name: 'Nursery Décor', slug: 'nursery-decor' },
        ],
      },
      {
        name: 'Maternity',
        slug: 'maternity',
        children: [
          { name: 'Maternity Clothing', slug: 'maternity-clothing' },
          { name: 'Nursing & Feeding', slug: 'nursing-feeding' },
        ],
      },
    ],
  },
  {
    name: 'Sports, Fitness & Outdoors',
    slug: 'sports-fitness-outdoors',
    children: [
      {
        name: 'Fitness Equipment',
        slug: 'fitness-equipment',
        children: [
          { name: 'Cardio Equipment', slug: 'cardio-equipment' },
          { name: 'Strength Training', slug: 'strength-training' },
          { name: 'Yoga & Pilates', slug: 'yoga-pilates' },
        ],
      },
      {
        name: 'Outdoor Recreation',
        slug: 'outdoor-recreation',
        children: [
          { name: 'Camping & Hiking', slug: 'camping-hiking' },
          { name: 'Cycling', slug: 'cycling' },
          { name: 'Water Sports', slug: 'water-sports' },
        ],
      },
      {
        name: 'Team Sports',
        slug: 'team-sports',
        children: [
          { name: 'Football', slug: 'football' },
          { name: 'Cricket', slug: 'cricket' },
          { name: 'Basketball', slug: 'basketball' },
        ],
      },
      {
        name: 'Sportswear',
        slug: 'sportswear',
        children: [
          { name: 'Running Apparel', slug: 'running-apparel' },
          { name: 'Gym Wear', slug: 'gym-wear' },
        ],
      },
    ],
  },
  {
    name: 'Travel & Luggage',
    slug: 'travel-luggage',
    children: [
      {
        name: 'Suitcases & Luggage',
        slug: 'suitcases-luggage',
        children: [
          { name: 'Carry-On Luggage', slug: 'carry-on-luggage' },
          { name: 'Checked Luggage', slug: 'checked-luggage' },
          { name: 'Luggage Sets', slug: 'luggage-sets' },
        ],
      },
      {
        name: 'Travel Accessories',
        slug: 'travel-accessories',
        children: [
          { name: 'Travel Pillows & Comfort', slug: 'travel-pillows-comfort' },
          { name: 'Travel Organizers', slug: 'travel-organizers' },
          { name: 'Passport Holders', slug: 'passport-holders' },
        ],
      },
      {
        name: 'Backpacks & Bags',
        slug: 'backpacks-bags',
        children: [
          { name: 'Travel Backpacks', slug: 'travel-backpacks' },
          { name: 'Duffel Bags', slug: 'duffel-bags' },
        ],
      },
    ],
  },
  {
    name: 'Tools, Hardware & Home Improvement',
    slug: 'tools-hardware-home-improvement',
    children: [
      {
        name: 'Power Tools',
        slug: 'power-tools',
        children: [
          { name: 'Drills & Drivers', slug: 'drills-drivers' },
          { name: 'Saws & Grinders', slug: 'saws-grinders' },
        ],
      },
      {
        name: 'Hand Tools',
        slug: 'hand-tools',
        children: [
          { name: 'Hammers & Wrenches', slug: 'hammers-wrenches' },
          { name: 'Screwdrivers & Tool Sets', slug: 'screwdrivers-tool-sets' },
        ],
      },
      {
        name: 'Building & Hardware',
        slug: 'building-hardware',
        children: [
          { name: 'Fasteners & Fixings', slug: 'fasteners-fixings' },
          { name: 'Paint & Supplies', slug: 'paint-supplies' },
        ],
      },
      {
        name: 'Electrical & Lighting',
        slug: 'electrical-lighting',
        children: [
          { name: 'Light Bulbs & Fixtures', slug: 'light-bulbs-fixtures' },
          { name: 'Electrical Accessories', slug: 'electrical-accessories' },
        ],
      },
      {
        name: 'Plumbing',
        slug: 'plumbing',
        children: [
          { name: 'Faucets & Fixtures', slug: 'faucets-fixtures' },
          { name: 'Pipes & Fittings', slug: 'pipes-fittings' },
        ],
      },
    ],
  },
  {
    name: 'Pets & Pet Supplies',
    slug: 'pets-pet-supplies',
    children: [
      {
        name: 'Dog Supplies',
        slug: 'dog-supplies',
        children: [
          { name: 'Dog Food', slug: 'dog-food' },
          { name: 'Dog Accessories', slug: 'dog-accessories' },
        ],
      },
      {
        name: 'Cat Supplies',
        slug: 'cat-supplies',
        children: [
          { name: 'Cat Food', slug: 'cat-food' },
          { name: 'Cat Litter & Accessories', slug: 'cat-litter-accessories' },
        ],
      },
      {
        name: 'Pet Accessories',
        slug: 'pet-accessories',
        children: [
          { name: 'Collars & Leashes', slug: 'collars-leashes' },
          { name: 'Pet Beds & Carriers', slug: 'pet-beds-carriers' },
        ],
      },
    ],
  },
  {
    name: 'Car & Automotive',
    slug: 'car-automotive',
    children: [
      {
        name: 'Car Accessories & Electronics',
        slug: 'car-accessories-electronics',
        children: [
          { name: 'Dash Cams', slug: 'dash-cams' },
          { name: 'Car Chargers & Holders', slug: 'car-chargers-holders' },
          { name: 'Car Audio', slug: 'car-audio' },
        ],
      },
      {
        name: 'Car Care & Maintenance',
        slug: 'car-care-maintenance',
        children: [
          { name: 'Cleaning & Detailing', slug: 'car-cleaning-detailing' },
          { name: 'Oils & Fluids', slug: 'oils-fluids' },
        ],
      },
      {
        name: 'Interior Accessories',
        slug: 'interior-accessories',
        children: [
          { name: 'Seat Covers & Mats', slug: 'seat-covers-mats' },
          { name: 'Organizers & Storage', slug: 'car-organizers-storage' },
        ],
      },
      {
        name: 'Exterior Accessories',
        slug: 'exterior-accessories',
        children: [
          { name: 'Car Covers', slug: 'car-covers' },
          { name: 'Exterior Styling', slug: 'exterior-styling' },
        ],
      },
    ],
  },
  {
    name: 'Office & Stationery',
    slug: 'office-stationery',
    children: [
      {
        name: 'Office Furniture',
        slug: 'office-furniture',
        children: [
          { name: 'Office Chairs', slug: 'office-chairs' },
          { name: 'Office Desks', slug: 'office-desks' },
          { name: 'Filing & Storage', slug: 'filing-storage' },
        ],
      },
      {
        name: 'Stationery & Supplies',
        slug: 'stationery-supplies',
        children: [
          { name: 'Pens & Writing', slug: 'pens-writing' },
          { name: 'Notebooks & Paper', slug: 'notebooks-paper' },
          { name: 'Desk Accessories', slug: 'desk-accessories' },
        ],
      },
      {
        name: 'Printers & Scanners',
        slug: 'printers-scanners',
        children: [
          { name: 'Printers', slug: 'printers' },
          { name: 'Ink & Toner', slug: 'ink-toner' },
        ],
      },
    ],
  },
  {
    name: 'Garden & Outdoor',
    slug: 'garden-outdoor',
    children: [
      {
        name: 'Garden Tools',
        slug: 'garden-tools',
        children: [
          { name: 'Hand Garden Tools', slug: 'hand-garden-tools' },
          { name: 'Lawn Mowers & Trimmers', slug: 'lawn-mowers-trimmers' },
        ],
      },
      {
        name: 'Plants & Seeds',
        slug: 'plants-seeds',
        children: [
          { name: 'Indoor Plants', slug: 'indoor-plants' },
          { name: 'Seeds & Bulbs', slug: 'seeds-bulbs' },
        ],
      },
      {
        name: 'Outdoor Furniture',
        slug: 'outdoor-furniture',
        children: [
          { name: 'Patio Sets', slug: 'patio-sets' },
          { name: 'Garden Chairs & Tables', slug: 'garden-chairs-tables' },
        ],
      },
      {
        name: 'Pool & Patio',
        slug: 'pool-patio',
        children: [
          { name: 'Pool Accessories', slug: 'pool-accessories' },
          { name: 'BBQ & Outdoor Cooking', slug: 'bbq-outdoor-cooking' },
        ],
      },
    ],
  },
];
