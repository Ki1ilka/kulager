// Telegram Web App API
const tg = window.Telegram.WebApp;
tg.expand();

// Данные
let products = [];
let cart = [];
let stores = {};
let currentDistrict = 1;
let selectedProduct = null;

// Загрузка данных из localStorage
function loadData() {
    const savedStores = localStorage.getItem('kulager_stores');
    if (savedStores) {
        stores = JSON.parse(savedStores);
    }

    const savedCart = localStorage.getItem('kulager_cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
}

// Сохранение данных
function saveData() {
    localStorage.setItem('kulager_stores', JSON.stringify(stores));
    localStorage.setItem('kulager_cart', JSON.stringify(cart));
}

// Загрузка продуктов
async function loadProducts() {
    try {
        const response = await fetch('products.json');
        const data = await response.json();
        products = data.categories;
        renderCategories();
        renderProducts();
    } catch (error) {
        console.error('Ошибка загрузки продуктов:', error);
        tg.showAlert('Ошибка загрузки базы данных продуктов');
    }
}

// Инициализация районов
function initDistricts() {
    const container = document.getElementById('districtButtons');
    for (let i = 1; i <= 5; i++) {
        const btn = document.createElement('button');
        btn.className = 'district-btn';
        btn.textContent = i;
        btn.onclick = () => selectDistrict(i);
        if (i === currentDistrict) {
            btn.classList.add('active');
        }
        container.appendChild(btn);
    }
}

// Выбор района
function selectDistrict(district) {
    currentDistrict = district;
    document.querySelectorAll('.district-btn').forEach((btn, index) => {
        btn.classList.toggle('active', index + 1 === district);
    });
    renderStoreList();
}

// Отрисовка списка магазинов
function renderStoreList() {
    const container = document.getElementById('storeList');
    const districtStores = stores[currentDistrict] || [];

    if (districtStores.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет сохраненных магазинов</div>';
        return;
    }

    container.innerHTML = '';
    districtStores.forEach((store, index) => {
        const item = document.createElement('div');
        item.className = 'store-item';
        item.innerHTML = `
            <div class="store-name">${store.name}</div>
            <div class="store-address">${store.address}</div>
        `;
        item.onclick = () => selectStore(store);
        container.appendChild(item);
    });
}

// Выбор магазина
function selectStore(store) {
    document.getElementById('storeName').value = store.name;
    document.getElementById('storeAddress').value = store.address;
    document.querySelectorAll('.store-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.store-item').classList.add('active');
}

// Отрисовка категорий
function renderCategories() {
    const select = document.getElementById('categorySelect');
    products.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        select.appendChild(option);
    });

    select.onchange = () => renderProducts();
}

// Отрисовка продуктов
function renderProducts() {
    const container = document.getElementById('productsGrid');
    const categoryId = document.getElementById('categorySelect').value;
    const searchTerm = document.getElementById('productSearch').value.toLowerCase();

    container.innerHTML = '';

    products.forEach(category => {
        if (categoryId && category.id !== categoryId) return;

        category.products.forEach(product => {
            if (searchTerm && !product.name.toLowerCase().includes(searchTerm)) return;

            const btn = document.createElement('button');
            btn.className = 'product-btn';
            btn.innerHTML = `
                <div class="product-name">${product.name}</div>
                <div class="product-price">${product.price} ₸/кг • ${product.weight} кг</div>
            `;
            btn.onclick = () => openProductModal(product);
            container.appendChild(btn);
        });
    });
}

// Поиск продуктов
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('productSearch');
    if (searchInput) {
        searchInput.addEventListener('input', renderProducts);
    }
});

// Открытие модального окна
function openProductModal(product) {
    selectedProduct = product;
    document.getElementById('modalProductName').textContent = product.name;
    document.getElementById('modalQuantity').value = '1';
    document.getElementById('productModal').classList.add('active');
}

// Закрытие модального окна
function closeModal() {
    document.getElementById('productModal').classList.remove('active');
    selectedProduct = null;
}

// Добавление в корзину
function addToCart() {
    const quantity = parseInt(document.getElementById('modalQuantity').value);

    if (!quantity || quantity <= 0) {
        tg.showAlert('Укажите количество');
        return;
    }

    cart.push({
        id: selectedProduct.id,
        name: selectedProduct.name,
        quantity: quantity,
        price: selectedProduct.price,
        weight: selectedProduct.weight
    });

    saveData();
    renderCart();
    closeModal();
    tg.HapticFeedback.notificationOccurred('success');
}

// Отрисовка корзины
function renderCart() {
    const container = document.getElementById('cartItems');

    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-state">Добавьте товары в заявку</div>';
        document.getElementById('totalWeight').textContent = '0 кг';
        document.getElementById('totalSum').textContent = '0 ₸';
        return;
    }

    container.innerHTML = '';
    let totalWeight = 0;
    let totalSum = 0;

    cart.forEach((item, index) => {
        const itemWeight = item.weight * item.quantity;
        const itemSum = item.price * item.weight * item.quantity;

        totalWeight += itemWeight;
        totalSum += itemSum;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-qty">${item.quantity} шт (${itemWeight.toFixed(1)} кг)</div>
            </div>
            <div class="cart-item-actions">
                <button class="btn-small btn-edit" onclick="editCartItem(${index})">✏️</button>
                <button class="btn-small btn-delete" onclick="removeCartItem(${index})">🗑️</button>
            </div>
        `;
        container.appendChild(div);
    });

    document.getElementById('totalWeight').textContent = `${totalWeight.toFixed(1)} кг`;
    document.getElementById('totalSum').textContent = `${Math.round(totalSum)} ₸`;
}

// Редактирование товара в корзине
function editCartItem(index) {
    const item = cart[index];
    const newQuantity = prompt('Новое количество:', item.quantity);

    if (newQuantity && parseInt(newQuantity) > 0) {
        cart[index].quantity = parseInt(newQuantity);
        saveData();
        renderCart();
        tg.HapticFeedback.notificationOccurred('success');
    }
}

// Удаление товара из корзины
function removeCartItem(index) {
    cart.splice(index, 1);
    saveData();
    renderCart();
    tg.HapticFeedback.notificationOccurred('success');
}

// Очистка заявки
function clearOrder() {
    if (cart.length === 0) return;

    tg.showConfirm('Очистить всю заявку?', (confirmed) => {
        if (confirmed) {
            cart = [];
            saveData();
            renderCart();
            tg.HapticFeedback.notificationOccurred('success');
        }
    });
}

// Отправка заявки
function sendOrder() {
    const storeName = document.getElementById('storeName').value.trim();
    const storeAddress = document.getElementById('storeAddress').value.trim();
    const comment = document.getElementById('orderComment').value.trim();

    if (!storeName || !storeAddress) {
        tg.showAlert('Укажите название и адрес магазина');
        return;
    }

    if (cart.length === 0) {
        tg.showAlert('Добавьте товары в заявку');
        return;
    }

    // Сохранение магазина в историю
    if (!stores[currentDistrict]) {
        stores[currentDistrict] = [];
    }

    const existingStore = stores[currentDistrict].find(
        s => s.name === storeName && s.address === storeAddress
    );

    if (!existingStore) {
        stores[currentDistrict].push({
            name: storeName,
            address: storeAddress
        });
        saveData();
    }

    // Формирование текста заявки
    let orderText = `${storeName} ${storeAddress}\n`;

    cart.forEach(item => {
        orderText += `${item.name} ${item.quantity} шт\n`;
    });

    if (comment) {
        orderText += `(${comment})\n`;
    }

    // Подсчет общего веса и суммы
    let totalWeight = 0;
    let totalSum = 0;

    cart.forEach(item => {
        totalWeight += item.weight * item.quantity;
        totalSum += item.price * item.weight * item.quantity;
    });

    orderText += `${totalWeight.toFixed(1)}кг\n`;
    orderText += `${Math.round(totalSum)} ₸`;

    // Отправка через Telegram Web App API
    tg.sendData(orderText);

    // Очистка корзины после отправки
    cart = [];
    document.getElementById('orderComment').value = '';
    saveData();
    renderCart();
}

// Копирование заявки в буфер обмена (для тестирования без Telegram)
function copyOrder() {
    const storeName = document.getElementById('storeName').value.trim();
    const storeAddress = document.getElementById('storeAddress').value.trim();
    const comment = document.getElementById('orderComment').value.trim();

    if (!storeName || !storeAddress || cart.length === 0) {
        alert('Заполните все поля');
        return;
    }

    let orderText = `${storeName} ${storeAddress}\n`;
    cart.forEach(item => {
        orderText += `${item.name} ${item.quantity} шт\n`;
    });
    if (comment) {
        orderText += `(${comment})\n`;
    }

    let totalWeight = 0;
    let totalSum = 0;
    cart.forEach(item => {
        totalWeight += item.weight * item.quantity;
        totalSum += item.price * item.weight * item.quantity;
    });

    orderText += `${totalWeight.toFixed(1)}кг\n`;
    orderText += `${Math.round(totalSum)} ₸`;

    navigator.clipboard.writeText(orderText).then(() => {
        alert('Заявка скопирована в буфер обмена!');
    });
}

// Инициализация
loadData();
loadProducts();
initDistricts();
renderStoreList();
renderCart();
