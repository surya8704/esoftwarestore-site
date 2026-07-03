const { loadProducts, saveProducts, formatCurrency } = window.esoftwareStore;

const form = document.querySelector("#product-form");
const listElement = document.querySelector("#admin-list");
const resetBtn = document.querySelector("#reset-btn");
const toast = document.querySelector("#toast");

const idInput = document.querySelector("#product-id");
const titleInput = document.querySelector("#title");
const priceInput = document.querySelector("#price");
const discountedPriceInput = document.querySelector("#discountedPrice");
const imageInput = document.querySelector("#image");
const ratingInput = document.querySelector("#rating");
const descriptionInput = document.querySelector("#description");

let products = loadProducts();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1700);
}

function resetForm() {
  form.reset();
  idInput.value = "";
}

function validatePrices(price, discountedPrice) {
  return discountedPrice <= price;
}

function renderAdminProducts() {
  if (!products.length) {
    listElement.innerHTML = '<p class="empty">No products yet. Add one using the form.</p>';
    return;
  }

  listElement.innerHTML = products
    .map(
      (product) => `
        <article class="admin-item">
          <img src="${product.image}" alt="${product.title}" loading="lazy" />
          <div>
            <h4>${product.title}</h4>
            <p>${formatCurrency(product.discountedPrice)} (Original ${formatCurrency(
              product.price
            )})</p>
          </div>
          <div class="mini-actions">
            <button class="edit-btn" data-action="edit" data-id="${product.id}" type="button">Edit</button>
            <button class="delete-btn" data-action="delete" data-id="${product.id}" type="button">Delete</button>
          </div>
        </article>
      `
    )
    .join("");
}

function populateForm(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  idInput.value = product.id;
  titleInput.value = product.title;
  priceInput.value = product.price;
  discountedPriceInput.value = product.discountedPrice;
  imageInput.value = product.image;
  ratingInput.value = product.rating;
  descriptionInput.value = product.description;
}

function upsertProduct(event) {
  event.preventDefault();

  const price = Number(priceInput.value);
  const discountedPrice = Number(discountedPriceInput.value);

  if (!validatePrices(price, discountedPrice)) {
    showToast("Discounted price must be less than or equal to original price.");
    return;
  }

  const productData = {
    id: idInput.value || `p-${Date.now()}`,
    title: titleInput.value.trim(),
    price,
    discountedPrice,
    image: imageInput.value.trim(),
    rating: Number(ratingInput.value),
    description: descriptionInput.value.trim(),
  };

  if (idInput.value) {
    products = products.map((item) => (item.id === idInput.value ? productData : item));
    showToast("Product updated.");
  } else {
    products.unshift(productData);
    showToast("Product added.");
  }

  saveProducts(products);
  renderAdminProducts();
  resetForm();
}

function handleListAction(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const productId = button.dataset.id;

  if (action === "edit") {
    populateForm(productId);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (action === "delete") {
    products = products.filter((item) => item.id !== productId);
    saveProducts(products);
    renderAdminProducts();
    showToast("Product deleted.");
  }
}

form.addEventListener("submit", upsertProduct);
listElement.addEventListener("click", handleListAction);
resetBtn.addEventListener("click", resetForm);

renderAdminProducts();
