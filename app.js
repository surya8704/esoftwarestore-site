const { loadProducts, formatCurrency } = window.esoftwareStore;

const grid = document.querySelector("#product-grid");
const searchInput = document.querySelector("#search");
const sortInput = document.querySelector("#sort");

let products = loadProducts();

function getDiscountPercent(product) {
  if (!product.price || product.price <= product.discountedPrice) {
    return 0;
  }
  return Math.round(((product.price - product.discountedPrice) / product.price) * 100);
}

function sortProducts(list, sortType) {
  const sorted = [...list];

  if (sortType === "lowToHigh") {
    sorted.sort((a, b) => a.discountedPrice - b.discountedPrice);
  } else if (sortType === "highToLow") {
    sorted.sort((a, b) => b.discountedPrice - a.discountedPrice);
  } else if (sortType === "discount") {
    sorted.sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a));
  }

  return sorted;
}

function productCardTemplate(product) {
  const discount = getDiscountPercent(product);

  return `
    <article class="product-card">
      <img src="${product.image}" alt="${product.title}" loading="lazy" />
      <div class="card-body">
        <h3>${product.title}</h3>
        <p class="description">${product.description}</p>
        <div class="price-row">
          <span class="price">${formatCurrency(product.discountedPrice)}</span>
          <span class="old-price">${formatCurrency(product.price)}</span>
          ${discount > 0 ? `<span class="badge">${discount}% OFF</span>` : ""}
        </div>
        <p class="rating">Rating: ${product.rating}/5</p>
      </div>
    </article>
  `;
}

function renderProducts() {
  const query = searchInput.value.trim().toLowerCase();
  const sortType = sortInput.value;

  const filtered = products.filter(
    (product) =>
      product.title.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query)
  );

  const finalList = sortProducts(filtered, sortType);

  if (!finalList.length) {
    grid.innerHTML = '<p class="empty">No products found for your search.</p>';
    return;
  }

  grid.innerHTML = finalList.map(productCardTemplate).join("");
}

function revealOnScroll() {
  const revealItems = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

searchInput.addEventListener("input", renderProducts);
sortInput.addEventListener("change", renderProducts);

window.addEventListener("storage", () => {
  products = loadProducts();
  renderProducts();
});

renderProducts();
revealOnScroll();
