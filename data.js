const STORAGE_KEY = "esoftwareStoreProducts";

const defaultProducts = [
  {
    id: "p1",
    title: "Microsoft Office 2016 Professional Plus Key for 5 Devices",
    price: 29.99,
    discountedPrice: 12.99,
    image:
      "https://images.unsplash.com/photo-1633419461186-7d40a38105ec?auto=format&fit=crop&w=900&q=80",
    rating: 4.9,
    description:
      "Complete Office suite including Word, Excel, PowerPoint, and Outlook for productivity-focused users.",
  },
  {
    id: "p2",
    title: "SQL Server 2025 Standard",
    price: 149.0,
    discountedPrice: 89.0,
    image:
      "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=900&q=80",
    rating: 4.8,
    description:
      "Secure and scalable database engine with enterprise features for analytics and core business operations.",
  },
  {
    id: "p3",
    title: "Windows 11 Home",
    price: 49.0,
    discountedPrice: 19.0,
    image:
      "https://images.unsplash.com/photo-1633412802994-5c058f151b66?auto=format&fit=crop&w=900&q=80",
    rating: 5.0,
    description:
      "Modern operating system for personal use with improved performance, security, and interface design.",
  },
  {
    id: "p4",
    title: "Windows 11 Pro (5 PC)",
    price: 69.0,
    discountedPrice: 39.0,
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
    rating: 5.0,
    description:
      "Business-oriented Windows edition with enhanced management and protection tools for multiple devices.",
  },
  {
    id: "p5",
    title: "Microsoft Office 2024 Professional Plus",
    price: 79.0,
    discountedPrice: 34.0,
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80",
    rating: 4.9,
    description:
      "Latest Office apps for document creation, collaboration, and business productivity with lifetime access.",
  },
  {
    id: "p6",
    title: "Microsoft Visio 2024 Lifetime",
    price: 59.0,
    discountedPrice: 27.0,
    image:
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=900&q=80",
    rating: 4.8,
    description:
      "Professional diagramming software for flowcharts, architecture, and process documentation.",
  },
  {
    id: "p7",
    title: "Microsoft Project 2024 Lifetime",
    price: 79.0,
    discountedPrice: 35.0,
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
    rating: 4.8,
    description:
      "Project planning, timeline management, and resource tracking for teams and individual professionals.",
  },
  {
    id: "p8",
    title: "Microsoft Office Home and Business 2024",
    price: 89.0,
    discountedPrice: 42.0,
    image:
      "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&q=80",
    rating: 4.9,
    description:
      "Reliable Office suite for freelancers and SMBs including Outlook and all major productivity tools.",
  },
];

function loadProducts() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultProducts));
    return [...defaultProducts];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid product data format");
    }
    return parsed;
  } catch (error) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultProducts));
    return [...defaultProducts];
  }
}

function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

window.esoftwareStore = {
  STORAGE_KEY,
  defaultProducts,
  loadProducts,
  saveProducts,
  formatCurrency,
};
