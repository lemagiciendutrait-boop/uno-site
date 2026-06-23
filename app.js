let products = [];
let cart = JSON.parse(localStorage.getItem('unoCart') || '[]');

function imagePath(deckPath, filename) {
  return 'image deck/' + deckPath + '/' + filename;
}

function coverPath(deck) {
  if (!deck.path) return '';
  if (deck.hasCover) {
    return imagePath(deck.path, 'couverture.jpg');
  }
  return imagePath(deck.path, '1.png');
}

function formatPrice(price) {
  return price.toLocaleString('fr-FR') + ' FCFA';
}

async function loadProducts() {
  const res = await fetch('products.json');
  products = await res.json();
  renderProducts();
  updateCartUI();
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = products.map(p => {
    if (p.isCustom) {
      return `
        <div class="product-card custom-card" onclick="customDeckContact()">
          <div class="custom-card-img">
            <div class="custom-icon">🎨</div>
            <div class="custom-badge">Sur mesure</div>
          </div>
          <div class="card-body">
            <h3>${p.name}</h3>
            <p style="color:#666;font-size:0.9rem;margin-bottom:0.8rem">${p.description}</p>
            <button class="btn-add btn-custom" onclick="event.stopPropagation(); customDeckContact()">
              ✏️ Nous contacter
            </button>
          </div>
        </div>
      `;
    }
    return `
      <div class="product-card" onclick="location.href='deck.html?id=${p.id}'">
        <img class="card-image" src="${coverPath(p)}" alt="${p.name}" loading="lazy">
        <div class="card-body">
          <h3>${p.name}</h3>
          <div class="meta">
            <span>${p.cardCount} cartes</span>
            <span class="price">${formatPrice(p.price)}</span>
          </div>
          <button class="btn-add" onclick="event.stopPropagation(); addToCart('${p.id}')">
            Ajouter au panier
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getProduct(id) {
  return products.find(p => p.id === id);
}

function addToCart(id) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, qty: 1 });
  }
  localStorage.setItem('unoCart', JSON.stringify(cart));
  updateCartUI();
  showToast('✅ ' + getProduct(id).name + ' ajouté au panier');
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  localStorage.setItem('unoCart', JSON.stringify(cart));
  updateCartUI();
}

function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }
  localStorage.setItem('unoCart', JSON.stringify(cart));
  updateCartUI();
}

function getCartTotal() {
  return cart.reduce((sum, item) => {
    const p = getProduct(item.id);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}

function updateCartUI() {
  const countEl = document.getElementById('cart-count');
  const itemsEl = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');

  if (countEl) countEl.textContent = cart.reduce((s, i) => s + i.qty, 0);

  if (itemsEl) {
    if (cart.length === 0) {
      itemsEl.innerHTML = '<div class="empty-cart">Votre panier est vide</div>';
    } else {
      itemsEl.innerHTML = cart.map(item => {
        const p = getProduct(item.id);
        if (!p) return '';
        return `
          <div class="cart-item">
            <img src="${coverPath(p)}" alt="${p.name}">
            <div class="item-info">
              <h4>${p.name}</h4>
              <div class="item-price">${formatPrice(p.price)}</div>
            </div>
            <div class="item-qty">
              <button onclick="updateQty('${p.id}', -1)">-</button>
              <span>${item.qty}</span>
              <button onclick="updateQty('${p.id}', 1)">+</button>
            </div>
            <button class="remove-item" onclick="removeFromCart('${p.id}')">&times;</button>
          </div>
        `;
      }).join('');
    }
  }

  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
}

function toggleCart() {
  document.getElementById('cart-overlay').classList.toggle('open');
  document.getElementById('cart-sidebar').classList.toggle('open');
}

function goToCheckout() {
  if (cart.length === 0) {
    showToast('❌ Votre panier est vide');
    return;
  }
  location.href = 'checkout.html';
}

async function submitSuggestion(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('suggest-name').value || 'Anonyme',
    theme: document.getElementById('suggest-theme').value,
    characters: document.getElementById('suggest-characters').value,
    reason: document.getElementById('suggest-reason').value
  };
  try {
    const res = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erreur');
    document.getElementById('suggest-form').style.display = 'none';
    document.getElementById('suggest-success').style.display = 'block';
  } catch {
    showToast('❌ Erreur lors de l\'envoi');
  }
}

function suggestDeck() {
  const theme = document.getElementById('suggest-theme')?.value || '';
  const chars = document.getElementById('suggest-characters')?.value || '';
  const reason = document.getElementById('suggest-reason')?.value || '';
  const msg = encodeURIComponent(
    '💡 *Idée de deck* 💡\n\n' +
    'Bonjour ! J\'aimerais voir un deck sur le thème suivant :\n\n' +
    '- *Thème proposé :* ' + theme + '\n' +
    '- *Personnages / univers :* ' + chars + '\n' +
    '- *Pourquoi :* ' + reason + '\n\n' +
    'Merci !'
  );
  window.open('https://wa.me/?text=' + msg, '_blank');
}

function customDeckContact() {
  const msg = encodeURIComponent(
    '🎨 *Demande de deck personnalisé* 🎨\n\n' +
    'Bonjour ! Je souhaiterais commander un deck UNO personnalisé.\n\n' +
    'Voici mes idées :\n' +
    '- *Thème / Personnages :* \n' +
    '- *Nombre de cartes :* \n' +
    '- *Couleurs souhaitées :* \n' +
    '- *Autres précisions :* \n\n' +
    'Merci de me donner un devis.'
  );
  window.open('https://wa.me/?text=' + msg, '_blank');
}

function copyNumber(num) {
  const el = document.createElement('textarea');
  el.value = num;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  showToast('✅ Numéro copié !');
}

function selectPayment(method) {
  document.getElementById('payment-box-wave').style.display = method === 'wave' ? 'block' : 'none';
  document.getElementById('payment-box-orange').style.display = method === 'orange' ? 'block' : 'none';
  document.getElementById('payment-box-delivery').style.display = method === 'delivery' ? 'block' : 'none';
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// --- Deck page ---
async function loadDeckPage() {
  const container = document.getElementById('deck-page');
  if (!container) return;
  await loadProducts();

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const deck = getProduct(id);
  if (!deck) {
    container.innerHTML = '<p>Deck introuvable.</p>';
    return;
  }

  document.title = deck.name + ' - Uno Personnalisé';

  container.innerHTML = `
    <div class="deck-header">
      <img class="cover" src="${coverPath(deck)}" alt="${deck.name}">
      <div class="info">
        <h1>${deck.name}</h1>
        <p>${deck.description}</p>
        <div class="price">${formatPrice(deck.price)}</div>
        <p style="color:#666">${deck.cardCount} cartes dans ce deck</p>
        <button class="btn-add" onclick="addToCart('${deck.id}')">
          Ajouter au panier
        </button>
      </div>
    </div>
    <h2>Toutes les cartes</h2>
    <p class="cards-count">${deck.cardCount} cartes au total</p>
    <div class="cards-grid" id="cards-grid"></div>
  `;

  const grid = document.getElementById('cards-grid');
  for (let i = 1; i <= deck.cardCount; i++) {
    const img = document.createElement('img');
    img.src = imagePath(deck.path, i + '.png');
    img.alt = deck.name + ' carte ' + i;
    img.loading = 'lazy';
    img.onclick = () => openModal(imagePath(deck.path, i + '.png'));
    img.onerror = function() { this.style.display = 'none'; };
    grid.appendChild(img);
  }
}

function openModal(src) {
  const modal = document.getElementById('card-modal');
  const img = document.getElementById('modal-image');
  if (!modal || !img) return;
  img.src = src;
  modal.classList.add('open');
}

function closeModal() {
  const modal = document.getElementById('card-modal');
  if (modal) modal.classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// --- Checkout page ---
function loadCheckout() {
  const itemsEl = document.getElementById('order-items');
  const totalEl = document.getElementById('checkout-total');
  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p style="color:#999">Votre panier est vide.</p>';
    if (totalEl) totalEl.textContent = '0 FCFA';
    return;
  }

  itemsEl.innerHTML = cart.map(item => {
    const p = getProduct(item.id);
    if (!p) return '';
    return `
      <div class="order-item">
        <span>${p.name} x${item.qty}</span>
        <span>${formatPrice(p.price * item.qty)}</span>
      </div>
    `;
  }).join('');

  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
}

function submitOrder(e) {
  e.preventDefault();
  if (cart.length === 0) {
    showToast('❌ Votre panier est vide');
    return;
  }

  const name = document.getElementById('name').value;
  const phone = document.getElementById('phone').value;
  const address = document.getElementById('address').value;
  const total = getCartTotal();
  const totalFormatted = formatPrice(total);

  const orderDetails = cart.map(item => {
    const p = getProduct(item.id);
    return `${p.name} x${item.qty} = ${formatPrice(p.price * item.qty)}`;
  }).join('\n');

  const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
  const paymentLabels = { wave: 'Wave', orange: 'Orange Money', delivery: 'Paiement à la livraison' };
  const paymentLabel = paymentLabels[paymentMethod];

  selectPayment(paymentMethod);

  document.getElementById('payment-total').textContent = totalFormatted;
  document.getElementById('payment-total-orange').textContent = totalFormatted;
  document.getElementById('payment-total-delivery').textContent = totalFormatted;
  document.getElementById('payment-total-delivery2').textContent = totalFormatted;
  document.getElementById('payment-total-summary').textContent = totalFormatted;
  document.getElementById('payment-order-details').textContent = cart.map(item => {
    const p = getProduct(item.id);
    return `${p.name} x${item.qty}`;
  }).join(', ');
  document.getElementById('payment-name').textContent = name;

  document.getElementById('payment-info').style.display = 'block';

  document.getElementById('btn-whatsapp').onclick = function() {
    const paymentMsg = paymentMethod === 'delivery'
      ? '📦 *Paiement à la livraison*'
      : '✅ *Paiement ' + paymentLabel + ' effectué*';

    const message = encodeURIComponent(
      '🃏 *Nouvelle commande UNO Personnalisé* 🃏\n\n' +
      '👤 *Nom:* ' + name + '\n' +
      '📞 *Téléphone:* ' + phone + '\n' +
      '📍 *Adresse:* ' + address + '\n\n' +
      '📦 *Détails de la commande:*\n' + orderDetails + '\n\n' +
      '💰 *Total:* ' + totalFormatted + '\n\n' +
      '💳 *Mode de paiement:* ' + paymentLabel + '\n' +
      paymentMsg
    );
    window.open('https://wa.me/?text=' + message, '_blank');

    cart = [];
    localStorage.setItem('unoCart', JSON.stringify(cart));
    updateCartUI();
    showToast('✅ Commande envoyée ! Nous vous contacterons bientôt.');
    document.getElementById('checkout-form').reset();
    loadCheckout();
    document.getElementById('payment-info').style.display = 'none';
  };
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  loadDeckPage();
  loadCheckout();
});
