let products = [];
let cart = JSON.parse(localStorage.getItem('cartesCart') || '[]');
const SHIPPING_FEE = 2000;
let appliedPromo = null;
let searchQuery = '';

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
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.style.display = 'none';
}

function filterProducts(query) {
  searchQuery = query.toLowerCase().trim();
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  const filtered = searchQuery
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery))
    : products;
  if (filtered.length === 0 && searchQuery) {
    grid.innerHTML = '<div class="no-results">😕 Aucun deck trouvé pour "<strong>' + searchQuery + '</strong>"</div>';
    return;
  }
  grid.innerHTML = filtered.map(p => {
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
            <span>${p.cardCount} cartes illustrées</span>
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
  localStorage.setItem('cartesCart', JSON.stringify(cart));
  updateCartUI();
  const badge = document.getElementById('cart-count');
  if (badge) {
    badge.classList.remove('badge-bounce');
    void badge.offsetWidth;
    badge.classList.add('badge-bounce');
  }
  showToast('✅ ' + getProduct(id).name + ' ajouté au panier');
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  localStorage.setItem('cartesCart', JSON.stringify(cart));
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
  localStorage.setItem('cartesCart', JSON.stringify(cart));
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
  window.open('https://wa.me/221785220081?text=' + msg, '_blank');
}

function customDeckContact() {
  const msg = encodeURIComponent(
    '🎨 *Demande de deck personnalisé* 🎨\n\n' +
    'Bonjour ! Je souhaiterais commander un deck personnalisé.\n\n' +
    'Voici mes idées :\n' +
    '- *Thème / Personnages :* \n' +
    '- *Nombre de cartes :* \n' +
    '- *Couleurs souhaitées :* \n' +
    '- *Autres précisions :* \n\n' +
    'Merci de me donner un devis.'
  );
  window.open('https://wa.me/221785220081?text=' + msg, '_blank');
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

function openWaveApp() {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) {
    window.location.href = 'intent://#Intent;scheme=wave;package=com.wave.personal;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.wave.personal;end';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    window.location.href = 'wave://';
    setTimeout(() => {
      window.location.href = 'https://apps.apple.com/sn/app/wave-mobile-money/id1523884528';
    }, 500);
  } else {
    window.open('https://play.google.com/store/apps/details?id=com.wave.personal', '_blank');
  }
}

function openOrangeApp() {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) {
    window.location.href = 'intent://#Intent;scheme=orangemoney;package=com.orange.mobile.orangemoney;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.orange.mobile.orangemoney;end';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    window.location.href = 'orangemoney://';
    setTimeout(() => {
      window.location.href = 'https://apps.apple.com/sn/app/orange-money-senegal/id1447224280';
    }, 500);
  } else {
    window.open('https://play.google.com/store/apps/details?id=com.orange.mobile.orangemoney', '_blank');
  }
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

  document.title = deck.name + ' - Cartes Personnalisées';

  container.innerHTML = `
    <div class="deck-header">
      <img class="cover" src="${coverPath(deck)}" alt="${deck.name}">
      <div class="info">
        <h1>${deck.name}</h1>
        <p>${deck.description}</p>
        <div class="price">${formatPrice(deck.price)}</div>
        <p style="color:#666">108 cartes complètes — ${deck.cardCount} illustrations uniques en aperçu ci-dessous</p>
        <button class="btn-add" onclick="addToCart('${deck.id}')">
          Ajouter au panier
        </button>
      </div>
    </div>
    <h2>Aperçu des cartes</h2>
    <p class="cards-count">${deck.cardCount} illustrations uniques sur les 108 cartes du deck</p>
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

async function applyPromoCode() {
  const input = document.getElementById('promo-code');
  const msg = document.getElementById('promo-message');
  const btn = document.querySelector('.btn-apply');
  const code = input.value.trim().toUpperCase();
  if (!code) return;

  btn.textContent = '...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/check-promo?code=' + encodeURIComponent(code));
    const data = await res.json();

    if (data.valid) {
      const pct = Math.round(data.discount * 100);
      appliedPromo = { code, discount: data.discount };
      msg.textContent = '✅ Code promo appliqué : -' + pct + '% sur tous les decks !';
      msg.className = 'promo-success';
      btn.classList.add('success');
      loadCheckout();
    } else {
      appliedPromo = null;
      msg.textContent = '❌ ' + data.message;
      msg.className = 'promo-error';
      btn.classList.remove('success');
      loadCheckout();
    }
  } catch {
    msg.textContent = '❌ Erreur de validation du code';
    msg.className = 'promo-error';
  }

  btn.textContent = 'Appliquer';
  btn.disabled = false;
}

function getDiscountedPrice(price) {
  if (!appliedPromo) return price;
  return Math.round(price * (1 - appliedPromo.discount));
}

// --- Checkout page ---
function loadCheckout() {
  const itemsEl = document.getElementById('order-items');
  const subtotalEl = document.getElementById('checkout-subtotal');
  const shippingEl = document.getElementById('checkout-shipping');
  const totalEl = document.getElementById('checkout-total');
  const discountEl = document.getElementById('checkout-discount');
  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p style="color:#999">Votre panier est vide.</p>';
    if (subtotalEl) subtotalEl.textContent = '0 FCFA';
    if (shippingEl) shippingEl.textContent = '0 FCFA';
    if (totalEl) totalEl.textContent = '0 FCFA';
    return;
  }

  itemsEl.innerHTML = cart.map(item => {
    const p = getProduct(item.id);
    if (!p) return '';
    const unitPrice = appliedPromo ? getDiscountedPrice(p.price) : p.price;
    return `
      <div class="order-item">
        <span>${p.name} x${item.qty}</span>
        <span>${formatPrice(unitPrice * item.qty)}</span>
      </div>
    `;
  }).join('');

  const subtotal = getCartTotal();
  const discounted = appliedPromo ? getDiscountedPrice(subtotal) : subtotal;
  const savings = subtotal - discounted;
  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  if (discountEl) {
    if (appliedPromo) {
      discountEl.textContent = '-' + formatPrice(savings);
      discountEl.parentElement.style.display = 'flex';
    } else {
      discountEl.parentElement.style.display = 'none';
    }
  }
  if (shippingEl) shippingEl.textContent = formatPrice(SHIPPING_FEE);
  if (totalEl) totalEl.textContent = formatPrice(discounted + SHIPPING_FEE);
}

function submitOrder(e) {
  e.preventDefault();
  if (cart.length === 0) {
    showToast('❌ Votre panier est vide');
    return;
  }

  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();

  let errors = [];
  if (!name) errors.push('nom');
  if (!phone) errors.push('téléphone');
  if (!address) errors.push('adresse');

  document.querySelectorAll('.form-group input, .form-group textarea').forEach(el => {
    el.style.borderColor = el.value.trim() ? '#ddd' : '#ed1c24';
  });

  if (errors.length > 0) {
    showToast('❌ Veuillez remplir : ' + errors.join(', '));
    return;
  }
  const subtotal = getCartTotal();
  const discounted = appliedPromo ? getDiscountedPrice(subtotal) : subtotal;
  const total = discounted + SHIPPING_FEE;
  const savings = subtotal - discounted;
  const subtotalFormatted = formatPrice(subtotal);
  const discountFormatted = appliedPromo ? '-' + formatPrice(savings) : '';
  const shippingFormatted = formatPrice(SHIPPING_FEE);
  const totalFormatted = formatPrice(total);

  const orderDetails = cart.map(item => {
    const p = getProduct(item.id);
    const unitPrice = appliedPromo ? getDiscountedPrice(p.price) : p.price;
    return `${p.name} x${item.qty} = ${formatPrice(unitPrice * item.qty)}`;
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
  document.getElementById('payment-promo-info').style.display = appliedPromo ? 'block' : 'none';
  document.getElementById('payment-shipping').textContent = shippingFormatted;
  document.getElementById('payment-order-details').textContent = cart.map(item => {
    const p = getProduct(item.id);
    return `${p.name} x${item.qty}`;
  }).join(', ');
  document.getElementById('payment-name').textContent = name;

  document.getElementById('payment-info').style.display = 'block';

  document.getElementById('payment-info').scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('btn-whatsapp').onclick = function() {
    const paymentMsg = paymentMethod === 'delivery'
      ? '📦 *Paiement à la livraison*'
      : '✅ *Paiement ' + paymentLabel + ' effectué*';

    const promoLine = appliedPromo
      ? '🎟️ *Code promo:* ' + appliedPromo.code + ' (-' + formatPrice(savings) + ')\n'
      : '';

    const message = encodeURIComponent(
      '🃏 *Nouvelle commande Cartes Personnalisées* 🃏\n\n' +
      '👤 *Nom:* ' + name + '\n' +
      '📞 *Téléphone:* ' + phone + '\n' +
      '📍 *Adresse:* ' + address + '\n\n' +
      '📦 *Détails de la commande:*\n' + orderDetails + '\n\n' +
      promoLine +
      '📦 *Frais de livraison:* ' + shippingFormatted + '\n' +
      '💰 *Total:* ' + totalFormatted + '\n\n' +
      '💳 *Mode de paiement:* ' + paymentLabel + '\n' +
      paymentMsg
    );
    window.open('https://wa.me/221785220081?text=' + message, '_blank');

    if (appliedPromo) {
      fetch('/api/use-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: appliedPromo.code })
      });
    }

    cart = [];
    localStorage.setItem('cartesCart', JSON.stringify(cart));
    updateCartUI();
    appliedPromo = null;
    document.getElementById('promo-code').value = '';
    document.getElementById('promo-message').textContent = '';
    document.querySelector('.btn-apply').classList.remove('success');
    document.getElementById('checkout-form').reset();
    loadCheckout();
    document.getElementById('payment-info').style.display = 'none';

    document.getElementById('success-modal').classList.add('open');
  };
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  loadDeckPage();
  loadCheckout();
});
