// Telegram Web App API
const tg = window.Telegram?.WebApp || { expand: () => {}, HapticFeedback: { notificationOccurred: () => {} } };
tg.expand();

// Данные
let products = [];
let cart = [];
let stores = {};
let logs = [];
let currentDistrict = 1;
let selectedProduct = null;
let currentTab = 'orders';

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

    const savedLogs = localStorage.getItem('kulager_logs');
    if (savedLogs) {
        logs = JSON.parse(savedLogs);
    }
}

// Сохранение данных
function saveData() {
    localStorage.setItem('kulager_stores', JSON.stringify(stores));
    localStorage.setItem('kulager_cart', JSON.stringify(cart));
    localStorage.setItem('kulager_logs', JSON.stringify(logs));
}

// Переключение вкладок
function switchTab(tabName) {
    currentTab = tabName;

    // Обновляем активные табы
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Загружаем данные для вкладки
    if (tabName === 'logs') {
        renderLogs();
    } else if (tabName === 'stats') {
        renderStats();
    }
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
        alert('Ошибка загрузки базы данных продуктов');
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
            <div class="store-item-info">
                <div class="store-name">${store.name}</div>
                <div class="store-address">${store.address}</div>
            </div>
            <button class="store-delete" onclick="deleteStore(${index}); event.stopPropagation();">🗑️</button>
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

// Удаление магазина
function deleteStore(index) {
    if (confirm('Удалить этот магазин из истории?')) {
        stores[currentDistrict].splice(index, 1);
        saveData();
        renderStoreList();
    }
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

    // Для ребер - ввод в кг (дробное число)
    const quantityInput = document.getElementById('modalQuantity');
    if (product.id === 'rebra') {
        quantityInput.type = 'number';
        quantityInput.step = '0.1';
        quantityInput.placeholder = 'Например: 1.2';
        quantityInput.value = '1.0';
        document.querySelector('#productModal label').textContent = 'Количество (кг)';
    } else {
        quantityInput.type = 'number';
        quantityInput.step = '1';
        quantityInput.placeholder = '1';
        quantityInput.value = '1';
        document.querySelector('#productModal label').textContent = 'Количество (шт)';
    }

    document.getElementById('productModal').classList.add('active');
}

// Закрытие модального окна
function closeModal() {
    document.getElementById('productModal').classList.remove('active');
    selectedProduct = null;
}

// Добавление в корзину
function addToCart() {
    const quantity = parseFloat(document.getElementById('modalQuantity').value);

    if (!quantity || quantity <= 0) {
        alert('Укажите количество');
        return;
    }

    // Для ребер quantity - это уже кг, для остальных - штуки
    const isRebra = selectedProduct.id === 'rebra';

    cart.push({
        id: selectedProduct.id,
        name: selectedProduct.name,
        quantity: quantity,
        price: selectedProduct.price,
        weight: selectedProduct.weight,
        isWeightBased: isRebra // флаг что это весовой товар
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
        let itemWeight, itemSum, displayText;

        if (item.isWeightBased) {
            // Для ребер: quantity - это уже кг
            itemWeight = item.quantity;
            itemSum = item.price * item.quantity;
            displayText = `${item.quantity} кг`;
        } else {
            // Для остальных: quantity - штуки
            itemWeight = item.weight * item.quantity;
            itemSum = item.price * item.weight * item.quantity;
            displayText = `${item.quantity} шт (${itemWeight.toFixed(1)} кг)`;
        }

        totalWeight += itemWeight;
        totalSum += itemSum;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-qty">${displayText}</div>
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
    const label = item.isWeightBased ? 'кг' : 'шт';
    const newQuantity = prompt(`Новое количество (${label}):`, item.quantity);

    if (newQuantity && parseFloat(newQuantity) > 0) {
        cart[index].quantity = parseFloat(newQuantity);
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
    if (confirm('Очистить всю заявку?')) {
        cart = [];
        document.getElementById('storeName').value = '';
        document.getElementById('storeAddress').value = '';
        document.getElementById('orderComment').value = '';
        saveData();
        renderCart();
        alert('Заявка очищена');
    }
}

// Генерация текста заявки
function generateOrderText() {
    const storeName = document.getElementById('storeName').value.trim();
    const storeAddress = document.getElementById('storeAddress').value.trim();
    const comment = document.getElementById('orderComment').value.trim();

    if (!storeName || !storeAddress) {
        return null;
    }

    if (cart.length === 0) {
        return null;
    }

    let orderText = `${storeName} ${storeAddress}\n`;

    cart.forEach(item => {
        if (item.isWeightBased) {
            // Для ребер: показываем кг
            orderText += `${item.name} ${item.quantity} кг\n`;
        } else {
            // Для остальных: показываем шт
            orderText += `${item.name} ${item.quantity} шт\n`;
        }
    });

    if (comment) {
        orderText += `(${comment})\n`;
    }

    let totalWeight = 0;
    let totalSum = 0;

    cart.forEach(item => {
        if (item.isWeightBased) {
            totalWeight += item.quantity;
            totalSum += item.price * item.quantity;
        } else {
            totalWeight += item.weight * item.quantity;
            totalSum += item.price * item.weight * item.quantity;
        }
    });

    orderText += `${totalWeight.toFixed(1)}кг\n`;
    orderText += `${Math.round(totalSum)} ₸`;

    return orderText;
}

// Предпросмотр заявки
function previewOrder() {
    const orderText = generateOrderText();

    if (!orderText) {
        alert('Заполните магазин и добавьте товары');
        return;
    }

    document.getElementById('previewText').value = orderText;
    document.getElementById('previewModal').classList.add('active');
}

// Закрытие предпросмотра
function closePreview() {
    document.getElementById('previewModal').classList.remove('active');
}

// Копирование из предпросмотра
function copyFromPreview() {
    const text = document.getElementById('previewText').value;
    navigator.clipboard.writeText(text).then(() => {
        alert('Заявка скопирована!');
        closePreview();
    });
}

// Копирование заявки
function copyOrder() {
    const storeName = document.getElementById('storeName').value.trim();
    const storeAddress = document.getElementById('storeAddress').value.trim();

    const orderText = generateOrderText();

    if (!orderText) {
        alert('Заполните магазин и добавьте товары');
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
    }

    // Сохранение в логи
    const log = {
        id: Date.now(),
        date: new Date().toISOString(),
        district: currentDistrict,
        storeName: storeName,
        storeAddress: storeAddress,
        items: [...cart],
        comment: document.getElementById('orderComment').value.trim(),
        text: orderText,
        totalWeight: cart.reduce((sum, item) => sum + item.weight * item.quantity, 0),
        totalSum: cart.reduce((sum, item) => sum + item.price * item.weight * item.quantity, 0)
    };

    logs.unshift(log);
    saveData();

    // Копирование в буфер
    navigator.clipboard.writeText(orderText).then(() => {
        alert('Заявка скопирована и сохранена в логи!');

        // Очистка корзины
        cart = [];
        document.getElementById('orderComment').value = '';
        saveData();
        renderCart();
    });
}

// Отрисовка логов
function renderLogs() {
    const container = document.getElementById('logsList');

    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет сохраненных заявок</div>';
        return;
    }

    container.innerHTML = '';

    logs.forEach((log, index) => {
        const date = new Date(log.date);
        const dateStr = date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const div = document.createElement('div');
        div.className = 'log-item';
        div.innerHTML = `
            <div class="log-header">
                <div>
                    <div class="log-store">${log.storeName}</div>
                    <div class="log-date">Район ${log.district} • ${dateStr}</div>
                </div>
            </div>
            <div class="log-content">${log.text}</div>
            <div class="log-actions">
                <button class="btn-primary" onclick="copyLog(${index})">📋 Копировать</button>
                <button class="btn-secondary" onclick="repeatOrder(${index})">🔄 Повторить</button>
                <button class="btn-delete" onclick="deleteLog(${index})">🗑️</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// Копирование лога
function copyLog(index) {
    const log = logs[index];
    navigator.clipboard.writeText(log.text).then(() => {
        alert('Заявка скопирована!');
    });
}

// Повторить заказ
function repeatOrder(index) {
    const log = logs[index];

    // Переключаемся на вкладку заявок
    document.querySelectorAll('.tab')[0].click();

    // Заполняем данные
    currentDistrict = log.district;
    selectDistrict(log.district);
    document.getElementById('storeName').value = log.storeName;
    document.getElementById('storeAddress').value = log.storeAddress;
    document.getElementById('orderComment').value = log.comment || '';

    // Заполняем корзину
    cart = [...log.items];
    saveData();
    renderCart();

    alert('Заказ загружен! Можете редактировать и отправить.');
}

// Удаление лога
function deleteLog(index) {
    if (confirm('Удалить эту заявку из истории?')) {
        logs.splice(index, 1);
        saveData();
        renderLogs();
    }
}

// Удаление всех логов
function clearAllLogs() {
    if (logs.length === 0) {
        alert('Нет логов для удаления');
        return;
    }

    if (confirm(`Удалить все ${logs.length} заявок из истории? Это действие нельзя отменить!`)) {
        logs = [];
        saveData();
        renderLogs();
        alert('Все логи удалены');
    }
}

// Отрисовка статистики
function renderStats() {
    const totalOrders = logs.length;
    const totalWeight = logs.reduce((sum, log) => sum + log.totalWeight, 0);
    const totalSum = logs.reduce((sum, log) => sum + log.totalSum, 0);

    document.getElementById('statTotalOrders').textContent = totalOrders;
    document.getElementById('statTotalWeight').textContent = `${totalWeight.toFixed(1)} кг`;
    document.getElementById('statTotalSum').textContent = `${Math.round(totalSum).toLocaleString('ru-RU')} ₸`;

    // Статистика по районам
    const byDistrict = {};
    for (let i = 1; i <= 5; i++) {
        byDistrict[i] = {
            orders: 0,
            weight: 0,
            sum: 0
        };
    }

    logs.forEach(log => {
        byDistrict[log.district].orders++;
        byDistrict[log.district].weight += log.totalWeight;
        byDistrict[log.district].sum += log.totalSum;
    });

    const container = document.getElementById('statsByDistrict');
    container.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const stat = byDistrict[i];
        const div = document.createElement('div');
        div.style.cssText = 'background: var(--tg-theme-bg-color, #fff); padding: 12px; border-radius: 8px; margin-bottom: 8px;';
        div.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">Район ${i}</div>
            <div style="font-size: 13px; color: var(--tg-theme-hint-color, #999);">
                Заявок: ${stat.orders} • Вес: ${stat.weight.toFixed(1)} кг • Сумма: ${Math.round(stat.sum).toLocaleString('ru-RU')} ₸
            </div>
        `;
        container.appendChild(div);
    }
}

// Инициализация
loadData();
loadProducts();
initDistricts();
renderStoreList();
renderCart();
