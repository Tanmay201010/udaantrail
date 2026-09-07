// =============================================
// UdaanPro - Accounting Web App
// =============================================

// --- State ---
let currentRole = localStorage.getItem('udaanRole') || null;
let settings = JSON.parse(localStorage.getItem('udaanSettings') || '{}');
let appData = { inventory: [], pos: [], journal: [], nextInvoice: 1 };
let currentSha = null;
let journalListenersAttached = false;

// --- Utility ---
function fmt(n) {
    return '₹ ' + (parseFloat(n) || 0).toFixed(2);
}

function today() {
    return new Date().toISOString().split('T')[0];
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getNextInvoiceNumber() {
    let maxNum = 0;
    (appData.pos || []).forEach(b => {
        const match = String(b.invoiceNo || '').match(/\d+/);
        if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxNum) maxNum = num;
        }
    });
    return maxNum + 1;
}

function ensureIds() {
    if (appData.journal) appData.journal.forEach(e => { if (!e.id) e.id = uid(); });
    if (appData.pos) appData.pos.forEach(b => { if (!b.id) b.id = uid(); });
    if (appData.inventory) appData.inventory.forEach(i => { if (!i.id) i.id = uid(); });
}

function saveLocal() {
    ensureIds();
    localStorage.setItem('udaanData', JSON.stringify(appData));
}

function loadLocal() {
    const d = localStorage.getItem('udaanData');
    if (d) {
        try { appData = JSON.parse(d); } catch(e) {}
    }
    if (!appData.inventory) appData.inventory = [];
    if (!appData.pos) appData.pos = [];
    if (!appData.journal) appData.journal = [];
    if (!appData.nextInvoice) appData.nextInvoice = 1;
    ensureIds();
}

// =============================================
// INIT APP
// =============================================
function initApp() {
    loadLocal();
    lucide.createIcons();

    if (!currentRole) {
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.style.display = 'flex';
        const appEl = document.getElementById('app');
        if (appEl) appEl.style.display = 'none';
    } else {
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.style.display = 'none';
        startApp();
    }

    // Login button
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('login-user').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('login-pass').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
}

function handleLogin() {
    const user = document.getElementById('login-user').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value.trim().toLowerCase();
    const errEl = document.getElementById('login-error');

    // Credentials: username=admin, password=sales or finance
    if (user === 'admin' && (pass === 'sales' || pass === 'finance')) {
        currentRole = pass; // 'sales' or 'finance'
        localStorage.setItem('udaanRole', currentRole);
        document.getElementById('login-overlay').style.display = 'none';
        errEl.style.display = 'none';
        startApp();
    } else {
        errEl.style.display = 'block';
    }
}

function startApp() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'none';

    const appEl = document.getElementById('app');
    if (appEl) appEl.style.display = 'flex';
    document.getElementById('logged-in-role').textContent = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);

    // Show/hide nav links based on role
    document.querySelectorAll('#app li[data-role]').forEach(li => {
        const role = li.getAttribute('data-role');
        if (role === 'all') {
            li.style.display = '';
        } else if (role === currentRole) {
            li.style.display = '';
        } else {
            li.style.display = 'none';
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', e => {
        e.preventDefault();
        localStorage.removeItem('udaanRole');
        currentRole = null;
        location.reload();
    });

    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');
    if (mobileMenuBtn) {
        mobileMenuBtn.style.display = '';
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('active');
        });
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }

    // Navigation
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            navigateTo(target);
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    });

    // Force sync button
    document.getElementById('force-sync-btn').addEventListener('click', () => {
        syncData();
    });

    // Load from GitHub if configured
    if (settings.pat && settings.owner && settings.repo) {
        fetchFromGitHub();
    } else {
        updateSyncStatus('Not configured', 'warning');
    }

    // Route to default
    const hash = location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash);

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        const h = location.hash.replace('#', '') || 'dashboard';
        navigateTo(h, false);
    });
}

// =============================================
// NAVIGATION / ROUTING
// =============================================
function navigateTo(target, pushState = true) {
    const container = document.getElementById('view-container');
    const tpl = document.getElementById('tpl-' + target);
    if (!tpl) return;

    container.innerHTML = '';
    const clone = tpl.content.cloneNode(true);
    container.appendChild(clone);
    lucide.createIcons();

    document.getElementById('page-title').textContent = pageTitles[target] || target;

    document.querySelectorAll('.nav-item').forEach(l => {
        l.classList.toggle('active', l.getAttribute('data-target') === target);
    });

    if (pushState) {
        history.pushState({ target }, '', '#' + target);
    }

    // Initialize the view
    switch (target) {
        case 'dashboard':       initDashboard(); break;
        case 'inventory':       initInventory(); break;
        case 'pos':             initPOS(); break;
        case 'bill-history':    initBillHistory(); break;
        case 'journal':         initJournal(); break;
        case 'ledger':          initLedger(); break;
        case 'trial-balance':   initTrialBalance(); break;
        case 'cash-book':       initCashBook(); break;
        case 'financial-statements': initFinancialStatements(); break;
        case 'settings':        initSettingsView(); break;
    }
}

const pageTitles = {
    'dashboard': 'Dashboard',
    'inventory': 'Inventory',
    'pos': 'Billing / POS',
    'bill-history': 'Bill History',
    'journal': 'Journal',
    'ledger': 'Ledger',
    'trial-balance': 'Trial Balance',
    'cash-book': 'Cash Book',
    'financial-statements': 'Financial Statements',
    'settings': 'Settings'
};

// =============================================
// DASHBOARD
// =============================================
function initDashboard() {
    const expenseKeywords = ['rent', 'salary', 'salaries', 'wages', 'expense', 'utilities', 'electricity', 'purchase', 'purchases', 'cost', 'loss', 'depreciation', 'freight', 'carriage', 'advertising', 'stationery', 'telephone', 'water', 'tax', 'discount allowed'];

    // Cash balance from journal (Cash and Bank accounts)
    let cashBalance = 0;
    appData.journal.forEach(e => {
        const d = (e.debitAcc || '').toLowerCase();
        const c = (e.creditAcc || '').toLowerCase();
        if (d.includes('cash') || d.includes('bank')) cashBalance += parseFloat(e.debitAmt) || 0;
        if (c.includes('cash') || c.includes('bank')) cashBalance -= parseFloat(e.creditAmt) || 0;
    });

    const cashEl = document.getElementById('dash-cash-balance');
    if (cashEl) cashEl.textContent = fmt(cashBalance);

    const billsEl = document.getElementById('dash-bills-count');
    if (billsEl) billsEl.textContent = appData.pos ? appData.pos.length : 0;

    // Total expenses (debit entries for expense accounts)
    let expenses = 0;
    appData.journal.forEach(e => {
        const d = (e.debitAcc || '').toLowerCase();
        const c = (e.creditAcc || '').toLowerCase();
        if (expenseKeywords.some(k => d.includes(k))) {
            expenses += parseFloat(e.debitAmt) || 0;
        }
        if (expenseKeywords.some(k => c.includes(k))) {
            expenses -= parseFloat(e.creditAmt) || 0;
        }
    });
    const expEl = document.getElementById('dash-expenses');
    if (expEl) expEl.textContent = fmt(Math.max(0, expenses));

    const jEl = document.getElementById('dash-journal-count');
    if (jEl) jEl.textContent = appData.journal ? appData.journal.length : 0;

    // Recent transactions table
    const tbody = document.querySelector('#dash-recent-table tbody');
    if (tbody) {
        const recent = [...appData.journal].reverse().slice(0, 10);
        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);">No transactions yet.</td></tr>';
        } else {
            tbody.innerHTML = recent.map(e => `
                <tr>
                    <td>${e.date || ''}</td>
                    <td>${e.desc || ''}</td>
                    <td>${e.debitAcc || ''} / ${e.creditAcc || ''}</td>
                    <td>${fmt(e.debitAmt || e.creditAmt)}</td>
                </tr>
            `).join('');
        }
    }
}

// =============================================
// INVENTORY
// =============================================
function initInventory() {
    renderInventoryTable();

    // New item button
    const newItemBtn = document.getElementById('new-item-btn');
    if (newItemBtn) {
        newItemBtn.addEventListener('click', () => {
            document.getElementById('inventory-modal').style.display = 'block';
            document.getElementById('inv-modal-title').textContent = 'Add New Product';
            document.getElementById('inv-edit-id').value = '';
            document.getElementById('inv-name').value = '';
            document.getElementById('inv-consignor').value = '';
            document.getElementById('inv-qty').value = '1';
            document.getElementById('inv-price').value = '';
        });
    }

    // Cancel modal
    const cancelBtn = document.getElementById('inv-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            document.getElementById('inventory-modal').style.display = 'none';
        });
    }

    // Save product
    const saveBtn = document.getElementById('inv-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const editId = document.getElementById('inv-edit-id').value;
            const name = document.getElementById('inv-name').value.trim();
            const consignor = document.getElementById('inv-consignor').value.trim();
            const qty = parseInt(document.getElementById('inv-qty').value) || 0;
            const price = parseFloat(document.getElementById('inv-price').value) || 0;

            if (!name || qty <= 0 || price <= 0) {
                alert('Please fill all required fields (Name, Qty > 0, Price > 0).');
                return;
            }

            if (editId) {
                const idx = appData.inventory.findIndex(i => String(i.id) === String(editId));
                if (idx >= 0) {
                    appData.inventory[idx] = { id: editId, name, consignor, qty, price };
                }
            } else {
                appData.inventory.push({ id: uid(), name, consignor, qty, price });
            }

            saveLocal();
            await syncData();
            document.getElementById('inventory-modal').style.display = 'none';
            renderInventoryTable();
        });
    }

    // Stock Audit & Reconcile button
    const reconcileBtn = document.getElementById('reconcile-stock-btn');
    if (reconcileBtn) {
        reconcileBtn.addEventListener('click', () => {
            openStockReconcileModal();
        });
    }

    const recCloseBtn = document.getElementById('reconcile-close-btn');
    const recCancelBtn = document.getElementById('reconcile-cancel-btn');
    if (recCloseBtn) {
        recCloseBtn.addEventListener('click', () => {
            document.getElementById('reconcile-modal').style.display = 'none';
        });
    }
    if (recCancelBtn) {
        recCancelBtn.addEventListener('click', () => {
            document.getElementById('reconcile-modal').style.display = 'none';
        });
    }

    const recApplyBtn = document.getElementById('reconcile-apply-btn');
    if (recApplyBtn) {
        recApplyBtn.addEventListener('click', async () => {
            const inputs = document.querySelectorAll('.reconcile-qty-input');
            inputs.forEach(inp => {
                const id = inp.getAttribute('data-id');
                const val = parseInt(inp.value, 10);
                const inv = appData.inventory.find(i => String(i.id) === String(id));
                if (inv && !isNaN(val)) {
                    inv.qty = val;
                }
            });
            saveLocal();
            await syncData();
            document.getElementById('reconcile-modal').style.display = 'none';
            renderInventoryTable();
            alert('✓ Inventory stock updated and synchronized successfully!');
        });
    }
}

function openStockReconcileModal() {
    const modal = document.getElementById('reconcile-modal');
    const tbody = document.querySelector('#reconcile-table tbody');
    if (!modal || !tbody) return;

    // Calculate total sold for each inventory item from POS sales
    const soldCounts = {};
    (appData.pos || []).forEach(b => {
        (b.items || []).forEach(item => {
            const key = item.id || (item.name || '').trim().toLowerCase();
            soldCounts[key] = (soldCounts[key] || 0) + (parseInt(item.qty, 10) || 0);
        });
    });

    if (appData.inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);padding:1rem;">No inventory products found.</td></tr>';
    } else {
        tbody.innerHTML = appData.inventory.map(item => {
            const keyById = item.id;
            const keyByName = (item.name || '').trim().toLowerCase();
            const totalSold = soldCounts[keyById] || soldCounts[keyByName] || 0;
            return `
                <tr>
                    <td><strong>${item.name}</strong>${item.consignor ? ` <span style="font-size:0.75rem;color:var(--text-secondary);">(${item.consignor})</span>` : ''}</td>
                    <td>${item.qty} units</td>
                    <td style="color:var(--accent);font-weight:600;">${totalSold} units</td>
                    <td>
                        <input type="number" class="reconcile-qty-input" data-id="${item.id}" value="${item.qty}" style="width:90px;padding:0.35rem 0.5rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);">
                    </td>
                </tr>
            `;
        }).join('');
    }

    modal.style.display = 'block';
    lucide.createIcons();
}

function renderInventoryTable() {
    const tbody = document.querySelector('#inventory-table tbody');
    if (!tbody) return;
    if (appData.inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">No products yet. Add a product to get started.</td></tr>';
        return;
    }
    tbody.innerHTML = appData.inventory.map(item => `
        <tr>
            <td>${item.name}</td>
            <td>${item.consignor || '—'}</td>
            <td>${item.qty}</td>
            <td>${fmt(item.price)}</td>
            <td style="display:flex;gap:0.5rem;">
                <button class="btn btn-sm btn-secondary inv-edit-btn" data-id="${item.id}">Edit</button>
                <button class="btn btn-sm btn-secondary inv-del-btn" data-id="${item.id}" style="color:var(--danger);">Delete</button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.inv-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const item = appData.inventory.find(i => String(i.id) === String(id));
            if (!item) return;
            document.getElementById('inventory-modal').style.display = 'block';
            document.getElementById('inv-modal-title').textContent = 'Edit Product';
            document.getElementById('inv-edit-id').value = item.id;
            document.getElementById('inv-name').value = item.name || '';
            document.getElementById('inv-consignor').value = item.consignor || '';
            document.getElementById('inv-qty').value = item.qty || 1;
            document.getElementById('inv-price').value = item.price || '';
        });
    });

    tbody.querySelectorAll('.inv-del-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            if (!confirm('Are you sure you want to delete this product?')) return;
            appData.inventory = appData.inventory.filter(i => String(i.id) !== String(id));
            saveLocal();
            syncData();
            renderInventoryTable();
        });
    });
}

// =============================================
// POS / BILLING
// =============================================
function initPOS() {
    let posItems = [];

    // Set Invoice No and Date
    document.getElementById('pos-no').value = '#' + String(getNextInvoiceNumber()).padStart(6, '0');
    document.getElementById('pos-date').value = today();

    // Populate product datalist for integrated in-selection search
    populatePosProductDatalist();

    function populatePosProductDatalist() {
        const datalist = document.getElementById('pos-product-datalist');
        if (!datalist) return;
        datalist.innerHTML = '';

        appData.inventory.forEach(item => {
            const stockText = item.qty > 0 ? `Stock: ${item.qty}` : 'Out of Stock (0)';
            const opt = document.createElement('option');
            opt.value = `${item.name}${item.consignor ? ' (' + item.consignor + ')' : ''} [${stockText}] — ₹ ${item.price}`;
            opt.setAttribute('data-id', item.id);
            datalist.appendChild(opt);
        });
    }

    function getSelectedInventoryItem(val) {
        if (!val) return null;
        const v = val.trim().toLowerCase();
        // 1. Check exact display match or name match
        let found = appData.inventory.find(i => {
            const stockText = i.qty > 0 ? `stock: ${i.qty}` : 'out of stock (0)';
            const formatted = `${i.name}${i.consignor ? ' (' + i.consignor + ')' : ''} [${stockText}] — ₹ ${i.price}`.toLowerCase();
            return formatted === v || i.name.toLowerCase() === v;
        });
        if (found) return found;

        // 2. Match startsWith
        found = appData.inventory.find(i => v.startsWith(i.name.toLowerCase()) || i.name.toLowerCase().startsWith(v));
        if (found) return found;

        // 3. Match includes
        found = appData.inventory.find(i => i.name.toLowerCase().includes(v) || (i.consignor && i.consignor.toLowerCase().includes(v)));
        return found || null;
    }

    const prodInput = document.getElementById('pos-product-input');
    const priceInput = document.getElementById('pos-sale-price');
    const stockBadge = document.getElementById('pos-stock-badge');

    function updateStockIndicator() {
        if (!prodInput) return;
        const inv = getSelectedInventoryItem(prodInput.value);
        if (inv) {
            if (priceInput && (!priceInput.value || priceInput.value === '0')) {
                priceInput.value = inv.price || '';
            }
            if (stockBadge) {
                if (inv.qty > 0) {
                    stockBadge.textContent = `Available: ${inv.qty} units`;
                    stockBadge.style.color = 'var(--success)';
                } else {
                    stockBadge.textContent = `⚠ Out of Stock (${inv.qty})`;
                    stockBadge.style.color = 'var(--danger)';
                }
            }
        } else {
            if (stockBadge) stockBadge.textContent = '';
        }
    }

    if (prodInput) {
        prodInput.addEventListener('input', updateStockIndicator);
        prodInput.addEventListener('change', updateStockIndicator);
    }

    function renderPosItems() {
        const container = document.getElementById('pos-items-container');
        if (!container) return;
        if (posItems.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem;">No items added yet.</p>';
            return;
        }
        let total = 0;
        posItems.forEach(i => total += i.salePrice * i.qty);
        container.innerHTML = `
            <table class="data-table" style="margin-bottom:0.5rem;">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th style="text-align:right;">Qty</th>
                        <th style="text-align:right;">Sale Price</th>
                        <th style="text-align:right;">Subtotal</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${posItems.map((item, idx) => `
                        <tr>
                            <td><strong>${item.name}</strong>${item.consignor ? ` <span style="font-size:0.75rem;color:var(--text-secondary);">(${item.consignor})</span>` : ''}</td>
                            <td style="text-align:right;font-weight:600;">${item.qty}</td>
                            <td style="text-align:right;">${fmt(item.salePrice)}</td>
                            <td style="text-align:right;font-weight:600;">${fmt(item.salePrice * item.qty)}</td>
                            <td style="text-align:right;"><button class="btn btn-sm btn-secondary pos-rm-btn" data-idx="${idx}" style="color:var(--danger);padding:0.2rem 0.5rem;">✕</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;padding:0.5rem;background:var(--bg-tertiary);border-radius:var(--radius-md);">
                <span>Items: <strong>${posItems.reduce((s,i) => s + i.qty, 0)}</strong></span>
                <span style="font-weight:bold;font-size:1.1rem;">Grand Total: <span style="color:var(--primary);">${fmt(total)}</span></span>
            </div>
        `;
        container.querySelectorAll('.pos-rm-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                posItems.splice(parseInt(btn.getAttribute('data-idx')), 1);
                renderPosItems();
            });
        });
    }

    document.getElementById('pos-add-item-btn').addEventListener('click', () => {
        const val = prodInput ? prodInput.value.trim() : '';
        const inv = getSelectedInventoryItem(val);
        const salePrice = parseFloat(priceInput ? priceInput.value : 0);

        if (!inv) {
            alert('Please select or type a valid product from inventory.');
            return;
        }
        if (!salePrice || salePrice <= 0) {
            alert('Please enter a valid sale price.');
            return;
        }

        const qtyInput = document.getElementById('pos-qty');
        const addQty = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;
        if (addQty <= 0) {
            alert('Please enter a valid quantity (1 or more).');
            return;
        }

        const existing = posItems.find(i => String(i.id) === String(inv.id) || (i.name || '').toLowerCase() === (inv.name || '').toLowerCase());
        const totalCartQty = (existing ? existing.qty : 0) + addQty;

        if (inv.qty <= 0) {
            if (!confirm(`Warning: "${inv.name}" is currently out of stock (Available: ${inv.qty}). Do you still want to proceed?`)) {
                return;
            }
        } else if (totalCartQty > inv.qty) {
            if (!confirm(`Warning: Only ${inv.qty} unit(s) available in stock. Cart will have ${totalCartQty}. Proceed anyway?`)) {
                return;
            }
        }

        if (existing) {
            existing.qty += addQty;
            existing.salePrice = salePrice; // update with latest entered price
        } else {
            posItems.push({ id: inv.id, name: inv.name, consignor: inv.consignor, costPrice: inv.price, salePrice: salePrice, qty: addQty });
        }

        // Reset item add inputs
        if (prodInput) {
            prodInput.value = '';
            prodInput.focus();
        }
        if (priceInput) priceInput.value = '';
        if (qtyInput) qtyInput.value = '1';
        if (stockBadge) stockBadge.textContent = '';
        populatePosProductDatalist();
        renderPosItems();
    });

    async function saveBill(withPrint) {
        const customer = document.getElementById('pos-customer').value.trim() || 'Walk-in Customer';
        const note = document.getElementById('pos-note').value;
        if (posItems.length === 0) { alert('Please add at least one item to the bill.'); return; }
        const total = posItems.reduce((s, i) => s + i.salePrice * i.qty, 0);

        // Pre-sync latest data from GitHub to prevent invoice number collision
        if (settings.pat && settings.owner && settings.repo) {
            updateSyncStatus('Syncing latest before billing...', 'warning');
            try {
                await fetchFromGitHub(false);
            } catch(e) {}
        }

        const nextNum = getNextInvoiceNumber();
        const invoiceNo = '#' + String(nextNum).padStart(6, '0');
        const terminalName = (settings && settings.terminal) ? settings.terminal.trim() : (localStorage.getItem('udaanTerminal') || 'Counter 1');

        const bill = {
            id: uid(),
            invoiceNo: invoiceNo,
            date: document.getElementById('pos-date').value || today(),
            customer,
            items: posItems.map(i => ({...i})),
            total,
            note,
            terminal: terminalName
        };
        appData.pos.push(bill);
        appData.nextInvoice = nextNum + 1;

        // Deduct sold quantities from inventory
        posItems.forEach(pi => {
            const inv = appData.inventory.find(i => String(i.id) === String(pi.id) || (i.name || '').toLowerCase() === (pi.name || '').toLowerCase());
            if (inv) {
                inv.qty = (parseInt(inv.qty, 10) || 0) - (parseInt(pi.qty, 10) || 0);
            }
        });

        // Double-entry accounting: route payment to Cash vs Bank/UPI
        const isBankPayment = note.toLowerCase().includes('upi') || note.toLowerCase().includes('bank') || note.toLowerCase().includes('card');
        const debitAccount = isBankPayment ? 'Bank' : 'Cash';
        const jEntry = {
            id: "j_" + bill.id,
            date: bill.date,
            desc: `Sale - Invoice ${bill.invoiceNo} to ${customer} [${note}] (${terminalName})`,
            debitAcc: debitAccount,
            debitAmt: total,
            creditAcc: 'Sales',
            creditAmt: total
        };
        appData.journal.push(jEntry);

        saveLocal();
        await syncData();

        if (withPrint) generateAndPrintBill(bill);

        // Reset POS Form
        posItems = [];
        document.getElementById('pos-customer').value = '';
        if (prodInput) prodInput.value = '';
        if (priceInput) priceInput.value = '';
        if (stockBadge) stockBadge.textContent = '';
        const qtyInp = document.getElementById('pos-qty');
        if (qtyInp) qtyInp.value = '1';
        document.getElementById('pos-no').value = '#' + String(getNextInvoiceNumber()).padStart(6, '0');
        renderPosItems();
        populatePosProductDatalist();
    }

    document.getElementById('generate-bill-btn').addEventListener('click', () => saveBill(true));
    document.getElementById('save-history-btn').addEventListener('click', () => saveBill(false));
}

function generateAndPrintBill(bill) {
    const itemsHTML = bill.items.map((item, idx) => `
        <tr>
            <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0;">${idx + 1}</td>
            <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0;">${item.name}</td>
            <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.qty}</td>
            <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; text-align: right;">₹ ${parseFloat(item.salePrice).toFixed(2)}</td>
            <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; text-align: right;">₹ ${(item.salePrice * item.qty).toFixed(2)}</td>
        </tr>
    `).join('');

    const dateStr = bill.date ? new Date(bill.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    const printHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${bill.invoiceNo}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: white; }
    .bill-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #e2e8f0; }
    .logo-section h2 { font-size: 1.5rem; font-weight: 700; color: #0f172a; }
    .logo-section p { color: #64748b; font-size: 0.85rem; margin-top: 0.25rem; }
    .meta-section { text-align: right; }
    .meta-section p { font-size: 0.9rem; color: #475569; }
    .title-area { display: flex; justify-content: space-between; align-items: center; margin: 2rem 0; }
    .invoice-label { font-size: 2rem; font-weight: 300; letter-spacing: 0.5em; color: #64748b; }
    .to-from { font-size: 0.9rem; }
    .to-from strong { display: block; color: #0f172a; font-size: 1rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    thead tr { background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
    thead th { padding: 0.75rem 1rem; text-align: left; font-size: 0.8rem; letter-spacing: 0.05em; color: #475569; text-transform: uppercase; }
    thead th:last-child, thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid #e2e8f0; padding-top: 1rem; margin-top: 1rem; }
    .grand-total { font-size: 1.1rem; font-weight: bold; }
    .amount { font-size: 1.3rem; color: #0f172a; }
    @media print { body { padding: 20px; } }
</style>
</head>
<body>
    <div class="bill-header">
        <div class="logo-section">
            <h2>UdaanPro</h2>
            <p>Delhi Public School Nacharam</p>
        </div>
        <div class="meta-section">
            <p><strong>Date Issued:</strong></p>
            <p>${dateStr}</p>
        </div>
    </div>

    <div class="title-area">
        <div class="to-from">
            <p style="color:#64748b;font-size:0.8rem;">INVOICE NO</p>
            <strong>${bill.invoiceNo}</strong>
        </div>
        <div class="invoice-label">IN VO IC E</div>
        <div class="to-from" style="text-align:right;">
            <p style="color:#64748b;font-size:0.8rem;">ISSUED TO</p>
            <strong>${bill.customer}</strong>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>NO</th>
                <th>DESCRIPTION</th>
                <th style="text-align:right;">QTY</th>
                <th style="text-align:right;">PRICE</th>
                <th style="text-align:right;">SUBTOTAL</th>
            </tr>
        </thead>
        <tbody>
            ${itemsHTML}
        </tbody>
    </table>

    <div class="footer">
        <div>
            <p style="color:#64748b;font-size:0.8rem;">PAYMENT METHOD</p>
            <p style="font-weight:600;">${bill.note || 'Cash'}</p>
        </div>
        <div style="text-align:right;">
            <p class="grand-total">GRAND TOTAL &nbsp; <span class="amount">₹ ${parseFloat(bill.total).toFixed(2)}</span></p>
        </div>
    </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(printHTML);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.print();
        };
    }
}

// =============================================
// BILL HISTORY
// =============================================
function initBillHistory() {
    let filtered = [...appData.pos].reverse(); // newest first
    let editModalItems = [];

    function render(list) {
        const tbody = document.querySelector('#bill-history-table tbody');
        const emptyMsg = document.getElementById('bill-history-empty');
        if (!tbody) return;

        if (list.length === 0) {
            tbody.innerHTML = '';
            if (emptyMsg) emptyMsg.style.display = 'block';
            return;
        }
        if (emptyMsg) emptyMsg.style.display = 'none';

        tbody.innerHTML = list.map(bill => {
            const itemSummary = (bill.items || [])
                .map(i => `${i.name} ×${i.qty}`)
                .join(', ');
            return `
                <tr>
                    <td><strong>${bill.invoiceNo || '—'}</strong></td>
                    <td>${bill.date || '—'}</td>
                    <td>${bill.customer || 'Walk-in'}</td>
                    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${itemSummary}">${itemSummary || '—'}</td>
                    <td>${bill.note || 'Cash'}</td>
                    <td style="text-align:right;font-weight:600;">${fmt(bill.total)}</td>
                    <td style="display:flex;gap:0.4rem;align-items:center;">
                        <button class="btn btn-sm btn-secondary edit-bill-btn" data-id="${bill.id}">
                            <i data-lucide="edit-2"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-secondary reprint-btn" data-id="${bill.id}">
                            <i data-lucide="printer"></i> Reprint
                        </button>
                        <button class="btn btn-sm btn-secondary delete-bill-btn" data-id="${bill.id}" style="color:var(--danger);">
                            <i data-lucide="trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();

        // Reprint
        tbody.querySelectorAll('.reprint-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const bill = appData.pos.find(b => String(b.id) === String(id));
                if (bill) generateAndPrintBill(bill);
            });
        });

        // Delete
        tbody.querySelectorAll('.delete-bill-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const bill = appData.pos.find(b => String(b.id) === String(id));
                if (!bill) return;
                if (!confirm(`Are you sure you want to delete Invoice ${bill.invoiceNo}? All sold items will be returned to inventory stock.`)) return;

                // Restore all items back to inventory stock
                (bill.items || []).forEach(item => {
                    const inv = appData.inventory.find(i => String(i.id) === String(item.id) || (i.name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase());
                    if (inv) {
                        inv.qty = (parseInt(inv.qty, 10) || 0) + (parseInt(item.qty, 10) || 0);
                    }
                });

                appData.pos = appData.pos.filter(b => String(b.id) !== String(id));
                // Delete matching journal entry
                appData.journal = appData.journal.filter(j => 
                    String(j.id) !== "j_" + String(id) && 
                    !((j.desc || '').includes(bill.invoiceNo))
                );
                saveLocal();
                await syncData();
                initBillHistory();
            });
        });

        // Edit
        tbody.querySelectorAll('.edit-bill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const bill = appData.pos.find(b => String(b.id) === String(id));
                if (!bill) return;
                openEditBillModal(bill);
            });
        });
    }

    function openEditBillModal(bill) {
        const modal = document.getElementById('edit-bill-modal');
        if (!modal) return;

        document.getElementById('edit-bill-title').textContent = `Edit Invoice ${bill.invoiceNo}`;
        document.getElementById('edit-bill-id').value = bill.id;
        document.getElementById('edit-bill-no').value = bill.invoiceNo;
        document.getElementById('edit-bill-date').value = bill.date || today();
        document.getElementById('edit-bill-customer').value = bill.customer || '';
        document.getElementById('edit-bill-payment').value = bill.note || 'Cash';

        editModalItems = JSON.parse(JSON.stringify(bill.items || []));
        renderEditBillItems();
        modal.style.display = 'block';
    }

    function renderEditBillItems() {
        const container = document.getElementById('edit-bill-items-list');
        const totalDisplay = document.getElementById('edit-bill-total-display');
        if (!container) return;

        let total = 0;
        if (editModalItems.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem;">No items in this invoice.</p>';
            if (totalDisplay) totalDisplay.textContent = fmt(0);
            return;
        }

        container.innerHTML = editModalItems.map((item, idx) => {
            const subtotal = (parseFloat(item.salePrice) || 0) * (parseInt(item.qty, 10) || 0);
            total += subtotal;
            return `
                <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border);">
                    <div style="flex:2;font-size:0.875rem;">
                        <strong>${item.name}</strong>
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:0.75rem;color:var(--text-secondary);">Qty</label>
                        <input type="number" min="1" step="1" class="edit-item-qty" data-idx="${idx}" value="${item.qty}" style="padding:0.4rem;width:100%;">
                    </div>
                    <div style="flex:1.2;">
                        <label style="font-size:0.75rem;color:var(--text-secondary);">Price (₹)</label>
                        <input type="number" min="0" step="1" class="edit-item-price" data-idx="${idx}" value="${item.salePrice}" style="padding:0.4rem;width:100%;">
                    </div>
                    <div style="width:70px;text-align:right;font-weight:600;font-size:0.875rem;">
                        ${fmt(subtotal)}
                    </div>
                    <button class="btn btn-sm btn-secondary edit-item-del" data-idx="${idx}" style="color:var(--danger);padding:0.3rem 0.5rem;">✕</button>
                </div>
            `;
        }).join('');

        if (totalDisplay) totalDisplay.textContent = fmt(total);

        // Quantity and Price change listeners
        container.querySelectorAll('.edit-item-qty').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'), 10);
                editModalItems[idx].qty = parseInt(e.target.value, 10) || 1;
                renderEditBillItems();
            });
        });

        container.querySelectorAll('.edit-item-price').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'), 10);
                editModalItems[idx].salePrice = parseFloat(e.target.value) || 0;
                renderEditBillItems();
            });
        });

        container.querySelectorAll('.edit-item-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                editModalItems.splice(idx, 1);
                renderEditBillItems();
            });
        });
    }

    // Modal cancel
    const editCancelBtn = document.getElementById('edit-bill-cancel-btn');
    if (editCancelBtn) {
        editCancelBtn.addEventListener('click', () => {
            const modal = document.getElementById('edit-bill-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    // Modal save
    const editSaveBtn = document.getElementById('edit-bill-save-btn');
    if (editSaveBtn) {
        editSaveBtn.addEventListener('click', async () => {
            const billId = document.getElementById('edit-bill-id').value;
            const bill = appData.pos.find(b => String(b.id) === String(billId));
            if (!bill) return;

            if (editModalItems.length === 0) {
                alert('An invoice must contain at least one item.');
                return;
            }

            const customer = document.getElementById('edit-bill-customer').value.trim() || 'Walk-in Customer';
            const date = document.getElementById('edit-bill-date').value || today();
            const note = document.getElementById('edit-bill-payment').value;
            const newTotal = editModalItems.reduce((sum, i) => sum + (parseFloat(i.salePrice) || 0) * (parseInt(i.qty, 10) || 0), 0);

            // Calculate inventory stock differential adjustments
            const oldItemMap = {};
            (bill.items || []).forEach(item => {
                const key = item.id || (item.name || '').trim().toLowerCase();
                oldItemMap[key] = (oldItemMap[key] || 0) + (parseInt(item.qty, 10) || 0);
            });

            const newItemMap = {};
            editModalItems.forEach(item => {
                const key = item.id || (item.name || '').trim().toLowerCase();
                newItemMap[key] = (newItemMap[key] || 0) + (parseInt(item.qty, 10) || 0);
            });

            const allKeys = new Set([...Object.keys(oldItemMap), ...Object.keys(newItemMap)]);
            allKeys.forEach(key => {
                const oldQty = oldItemMap[key] || 0;
                const newQty = newItemMap[key] || 0;
                const diff = oldQty - newQty; // diff > 0 => return to stock; diff < 0 => deduct more
                if (diff !== 0) {
                    const inv = appData.inventory.find(i => String(i.id) === String(key) || (i.name || '').trim().toLowerCase() === key.toLowerCase());
                    if (inv) {
                        inv.qty = (parseInt(inv.qty, 10) || 0) + diff;
                    }
                }
            });

            // Update Bill
            bill.customer = customer;
            bill.date = date;
            bill.note = note;
            bill.items = editModalItems;
            bill.total = newTotal;

            // Reconcile matching journal entry
            const isBankPayment = note.toLowerCase().includes('upi') || note.toLowerCase().includes('bank') || note.toLowerCase().includes('card');
            const debitAccount = isBankPayment ? 'Bank' : 'Cash';
            const jEntry = appData.journal.find(j => 
                String(j.id) === "j_" + String(billId) || 
                ((j.desc || '').includes(bill.invoiceNo))
            );
            if (jEntry) {
                jEntry.date = date;
                jEntry.desc = `Sale - Invoice ${bill.invoiceNo} to ${customer} [${note}]`;
                jEntry.debitAcc = debitAccount;
                jEntry.debitAmt = newTotal;
                jEntry.creditAmt = newTotal;
            }

            saveLocal();
            await syncData();

            const modal = document.getElementById('edit-bill-modal');
            if (modal) modal.style.display = 'none';
            initBillHistory();
        });
    }

    // Product dropdown population
    const productSelect = document.getElementById('bill-product-filter');
    if (productSelect) {
        const productSet = new Set();
        (appData.pos || []).forEach(b => {
            (b.items || []).forEach(i => {
                if (i.name && i.name.trim()) productSet.add(i.name.trim());
            });
        });
        (appData.inventory || []).forEach(item => {
            if (item.name && item.name.trim()) productSet.add(item.name.trim());
        });

        const sortedProducts = Array.from(productSet).sort((a, b) => a.localeCompare(b));
        productSelect.innerHTML = '<option value="">All Products</option>' +
            sortedProducts.map(p => `<option value="${p.replace(/"/g, '&quot;')}">${p}</option>`).join('');
    }

    function applyBillFilters() {
        const searchInput = document.getElementById('bill-search');
        const productSelect = document.getElementById('bill-product-filter');
        const summaryEl = document.getElementById('bill-filter-summary');

        const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedProduct = productSelect ? productSelect.value : '';

        let results = filtered;

        // Filter by product dropdown if selected
        if (selectedProduct) {
            results = results.filter(b => 
                (b.items || []).some(i => (i.name || '').trim().toLowerCase() === selectedProduct.toLowerCase())
            );
        }

        // Filter by search query (checks customer, invoiceNo, date, and items name / consignor)
        if (q) {
            results = results.filter(b =>
                (b.customer || '').toLowerCase().includes(q) ||
                (b.invoiceNo || '').toLowerCase().includes(q) ||
                (b.date || '').includes(q) ||
                (b.items || []).some(i => 
                    (i.name || '').toLowerCase().includes(q) || 
                    (i.consignor || '').toLowerCase().includes(q)
                )
            );
        }

        // Update summary box if filtered
        if (summaryEl) {
            if (q || selectedProduct) {
                summaryEl.style.display = 'flex';
                let totalUnits = 0;
                let totalFilteredRevenue = 0;

                results.forEach(b => {
                    (b.items || []).forEach(i => {
                        const itemQty = parseInt(i.qty, 10) || 0;
                        const itemRev = (parseFloat(i.salePrice) || 0) * itemQty;

                        if (selectedProduct) {
                            // Calculate units and revenue ONLY for the selected product
                            if ((i.name || '').trim().toLowerCase() === selectedProduct.toLowerCase()) {
                                totalUnits += itemQty;
                                totalFilteredRevenue += itemRev;
                            }
                        } else if (q) {
                            const isItemMatch = (i.name || '').toLowerCase().includes(q) || (i.consignor || '').toLowerCase().includes(q);
                            const isInvoiceMatch = (b.customer || '').toLowerCase().includes(q) || (b.invoiceNo || '').toLowerCase().includes(q) || (b.date || '').includes(q);
                            
                            if (isItemMatch) {
                                totalUnits += itemQty;
                                totalFilteredRevenue += itemRev;
                            } else if (isInvoiceMatch) {
                                totalUnits += itemQty;
                                totalFilteredRevenue += itemRev;
                            }
                        }
                    });
                });

                const productLabel = selectedProduct ? `<strong>${selectedProduct}</strong>` : `"${q}"`;
                summaryEl.innerHTML = `
                    <span>🔍 Found <strong>${results.length}</strong> matching invoice${results.length === 1 ? '' : 's'} for ${productLabel}</span>
                    <span style="display:inline-flex;gap:1.5rem;font-weight:600;">
                        <span>Units Sold: <span style="color:var(--primary);">${totalUnits}</span></span>
                        <span>Total Revenue: <span style="color:var(--primary);">${fmt(totalFilteredRevenue)}</span></span>
                    </span>
                `;
            } else {
                summaryEl.style.display = 'none';
            }
        }

        render(results);
    }

    // Initial render
    applyBillFilters();

    // Filter listeners
    if (productSelect) {
        productSelect.addEventListener('change', applyBillFilters);
    }

    const searchInput = document.getElementById('bill-search');
    if (searchInput) {
        searchInput.addEventListener('input', applyBillFilters);
    }

    // Export CSV
    const exportBtn = document.getElementById('export-bills-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (appData.pos.length === 0) { alert('No bills to export.'); return; }
            const header = 'Invoice No,Date,Customer,Items,Payment,Total\n';
            const rows = [...appData.pos].reverse().map(b => {
                const items = (b.items || []).map(i => `${i.name}x${i.qty}`).join(' | ');
                return [b.invoiceNo, b.date, b.customer, `"${items}"`, b.note, b.total].join(',');
            }).join('\n');
            const blob = new Blob([header + rows], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'bill_history.csv';
            a.click();
        });
    }

    // Import JSON
    const importBtn = document.getElementById('import-bills-btn');
    const importInput = document.getElementById('import-bills-input');
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                importJsonFile(file, () => {
                    initBillHistory();
                });
            }
        });
    }
}

// =============================================
// JOURNAL
// =============================================
function initJournal() {
    renderJournalTable();

    if (!journalListenersAttached) {
        journalListenersAttached = true;

        document.addEventListener('click', e => {
            // New entry button
            if (e.target.closest('#new-journal-btn')) {
                const modal = document.getElementById('journal-modal');
                if (!modal) return;
                modal.style.display = 'block';
                document.getElementById('journal-modal-title').textContent = 'New Journal Entry';
                document.getElementById('j-edit-id').value = '';
                document.getElementById('j-date').value = today();
                document.getElementById('j-desc').value = '';
                document.getElementById('j-debit-acc').value = '';
                document.getElementById('j-debit-amt').value = '';
                document.getElementById('j-credit-acc').value = '';
                document.getElementById('j-credit-amt').value = '';
            }

            // Cancel
            if (e.target.closest('#j-cancel-btn')) {
                const modal = document.getElementById('journal-modal');
                if (modal) modal.style.display = 'none';
            }

            // Save
            if (e.target.closest('#j-save-btn')) {
                const editId = document.getElementById('j-edit-id').value;
                const entry = {
                    id: editId || uid(),
                    date: document.getElementById('j-date').value,
                    desc: document.getElementById('j-desc').value.trim(),
                    debitAcc: document.getElementById('j-debit-acc').value.trim(),
                    debitAmt: parseFloat(document.getElementById('j-debit-amt').value) || 0,
                    creditAcc: document.getElementById('j-credit-acc').value.trim(),
                    creditAmt: parseFloat(document.getElementById('j-credit-amt').value) || 0,
                };
                if (!entry.desc || !entry.debitAcc || !entry.creditAcc) {
                    alert('Please fill in description, debit account, and credit account.');
                    return;
                }
                if (editId) {
                    const idx = appData.journal.findIndex(j => j.id === editId);
                    if (idx >= 0) appData.journal[idx] = entry;
                } else {
                    appData.journal.push(entry);
                }
                saveLocal();
                syncData();
                const modal = document.getElementById('journal-modal');
                if (modal) modal.style.display = 'none';
                renderJournalTable();
            }

            // Edit
            const editBtn = e.target.closest('.j-edit-btn');
            if (editBtn) {
                const id = editBtn.getAttribute('data-id');
                const entry = appData.journal.find(j => String(j.id) === String(id));
                if (!entry) return;
                const modal = document.getElementById('journal-modal');
                if (!modal) return;
                modal.style.display = 'block';
                document.getElementById('journal-modal-title').textContent = 'Edit Journal Entry';
                document.getElementById('j-edit-id').value = entry.id;
                document.getElementById('j-date').value = entry.date || '';
                document.getElementById('j-desc').value = entry.desc || '';
                document.getElementById('j-debit-acc').value = entry.debitAcc || '';
                document.getElementById('j-debit-amt').value = entry.debitAmt || '';
                document.getElementById('j-credit-acc').value = entry.creditAcc || '';
                document.getElementById('j-credit-amt').value = entry.creditAmt || '';
            }

            // Delete
            const delBtn = e.target.closest('.j-del-btn');
            if (delBtn) {
                const id = delBtn.getAttribute('data-id');
                if (!confirm('Delete this entry?')) return;
                appData.journal = appData.journal.filter(j => String(j.id) !== String(id));
                saveLocal();
                syncData();
                renderJournalTable();
            }
        });
    }

    // Export button
    const exportBtn = document.getElementById('export-journal-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportJournalCSV);
    }
}

function renderJournalTable() {
    const tbody = document.querySelector('#journal-table tbody');
    if (!tbody) return;
    if (appData.journal.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);">No journal entries yet.</td></tr>';
        return;
    }
    tbody.innerHTML = [...appData.journal].reverse().map(e => `
        <tr>
            <td>${e.date || ''}</td>
            <td>${e.debitAcc || ''} / ${e.creditAcc || ''}</td>
            <td>${e.desc || ''}</td>
            <td>${e.debitAmt ? fmt(e.debitAmt) : '—'}</td>
            <td>${e.creditAmt ? fmt(e.creditAmt) : '—'}</td>
            <td style="display:flex;gap:0.5rem;">
                <button class="btn btn-sm btn-secondary j-edit-btn" data-id="${e.id}">Edit</button>
                <button class="btn btn-sm btn-secondary j-del-btn" data-id="${e.id}" style="color:var(--danger);">Del</button>
            </td>
        </tr>
    `).join('');
}

function exportJournalCSV() {
    if (appData.journal.length === 0) { alert('No entries to export.'); return; }
    const header = 'Date,Description,Debit Account,Debit Amount,Credit Account,Credit Amount\n';
    const rows = appData.journal.map(e => [e.date, e.desc, e.debitAcc, e.debitAmt, e.creditAcc, e.creditAmt].join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'journal_export.csv';
    a.click();
}

// =============================================
// LEDGER
// =============================================
function initLedger() {
    const select = document.getElementById('ledger-acc-select');
    if (!select) return;

    // Get all unique accounts from journal
    const accounts = new Set();
    appData.journal.forEach(e => {
        if (e.debitAcc) accounts.add(e.debitAcc);
        if (e.creditAcc) accounts.add(e.creditAcc);
    });

    select.innerHTML = '<option value="">Select Account...</option>';
    [...accounts].sort().forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc;
        opt.textContent = acc;
        select.appendChild(opt);
    });

    select.addEventListener('change', () => {
        renderLedger(select.value);
    });
}

function renderLedger(account) {
    const tbody = document.querySelector('#ledger-table tbody');
    if (!tbody) return;

    if (!account) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">Select an account to view its ledger.</td></tr>';
        return;
    }

    const entries = appData.journal.filter(e => e.debitAcc === account || e.creditAcc === account);
    entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">No transactions for this account.</td></tr>';
        return;
    }

    let balance = 0;
    tbody.innerHTML = entries.map(e => {
        let debit = 0, credit = 0, particulars = '';
        if (e.debitAcc === account) {
            debit = parseFloat(e.debitAmt) || 0;
            particulars = `By ${e.creditAcc}`;
        }
        if (e.creditAcc === account) {
            credit = parseFloat(e.creditAmt) || 0;
            particulars = `To ${e.debitAcc}`;
        }
        balance += debit - credit;
        const balStr = (balance >= 0 ? '' : '-') + '₹ ' + Math.abs(balance).toFixed(2) + (balance >= 0 ? ' Dr' : ' Cr');
        return `
            <tr>
                <td>${e.date || ''}</td>
                <td>${e.desc || ''}<br><small style="color:var(--text-secondary);">${particulars}</small></td>
                <td>${debit ? fmt(debit) : '—'}</td>
                <td>${credit ? fmt(credit) : '—'}</td>
                <td>${balStr}</td>
            </tr>
        `;
    }).join('');
}

// =============================================
// TRIAL BALANCE
// =============================================
function initTrialBalance() {
    const accounts = {};
    appData.journal.forEach(e => {
        if (e.debitAcc) {
            if (!accounts[e.debitAcc]) accounts[e.debitAcc] = { debit: 0, credit: 0 };
            accounts[e.debitAcc].debit += parseFloat(e.debitAmt) || 0;
        }
        if (e.creditAcc) {
            if (!accounts[e.creditAcc]) accounts[e.creditAcc] = { debit: 0, credit: 0 };
            accounts[e.creditAcc].credit += parseFloat(e.creditAmt) || 0;
        }
    });

    const tbody = document.querySelector('#tb-table tbody');
    if (!tbody) return;

    const names = Object.keys(accounts).sort();
    let totalDebit = 0, totalCredit = 0;

    if (names.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-secondary);">No data available.</td></tr>';
    } else {
        tbody.innerHTML = names.map(acc => {
            const { debit, credit } = accounts[acc];
            // Net: show debit balance or credit balance
            const netDebit = Math.max(0, debit - credit);
            const netCredit = Math.max(0, credit - debit);
            totalDebit += netDebit;
            totalCredit += netCredit;
            return `
                <tr>
                    <td>${acc}</td>
                    <td style="text-align:right;">${netDebit > 0 ? fmt(netDebit) : '—'}</td>
                    <td style="text-align:right;">${netCredit > 0 ? fmt(netCredit) : '—'}</td>
                </tr>
            `;
        }).join('');
    }

    const tdEl = document.getElementById('tb-total-debit');
    const tcEl = document.getElementById('tb-total-credit');
    if (tdEl) tdEl.innerHTML = `<strong>${fmt(totalDebit)}</strong>`;
    if (tcEl) tcEl.innerHTML = `<strong>${fmt(totalCredit)}</strong>`;
}

// =============================================
// CASH BOOK
// =============================================
function initCashBook() {
    const cashEntries = [];
    appData.journal.forEach(e => {
        const d = (e.debitAcc || '').toLowerCase();
        const c = (e.creditAcc || '').toLowerCase();
        if (d.includes('cash')) {
            cashEntries.push({ date: e.date, particulars: e.desc + ` (from ${e.creditAcc})`, receipts: parseFloat(e.debitAmt) || 0, payments: 0 });
        }
        if (c.includes('cash')) {
            cashEntries.push({ date: e.date, particulars: e.desc + ` (to ${e.debitAcc})`, receipts: 0, payments: parseFloat(e.creditAmt) || 0 });
        }
    });
    cashEntries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const tbody = document.querySelector('#cash-book-table tbody');
    if (!tbody) return;

    if (cashEntries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">No cash transactions yet.</td></tr>';
        return;
    }

    let balance = 0;
    tbody.innerHTML = cashEntries.map(entry => {
        balance += entry.receipts - entry.payments;
        const balStr = (balance >= 0 ? '₹ ' : '-₹ ') + Math.abs(balance).toFixed(2);
        return `
            <tr>
                <td>${entry.date || ''}</td>
                <td>${entry.particulars}</td>
                <td style="color:var(--success);">${entry.receipts ? fmt(entry.receipts) : '—'}</td>
                <td style="color:var(--danger);">${entry.payments ? fmt(entry.payments) : '—'}</td>
                <td>${balStr}</td>
            </tr>
        `;
    }).join('');
}

// =============================================
// FINANCIAL STATEMENTS
// =============================================
function initFinancialStatements() {
    // 1. Calculate trial balances for all accounts
    const accounts = {};
    appData.journal.forEach(e => {
        if (e.debitAcc) {
            if (!accounts[e.debitAcc]) accounts[e.debitAcc] = { debit: 0, credit: 0 };
            accounts[e.debitAcc].debit += parseFloat(e.debitAmt) || 0;
        }
        if (e.creditAcc) {
            if (!accounts[e.creditAcc]) accounts[e.creditAcc] = { debit: 0, credit: 0 };
            accounts[e.creditAcc].credit += parseFloat(e.creditAmt) || 0;
        }
    });

    // Account Keyword Dictionaries
    const incomeKeywords = ['sales', 'revenue', 'income', 'gain', 'interest received', 'commission received', 'discount received'];
    const expenseKeywords = ['rent', 'salary', 'salaries', 'wages', 'expense', 'utilities', 'electricity', 'purchase', 'purchases', 'cost', 'loss', 'depreciation', 'freight', 'carriage', 'advertising', 'stationery', 'telephone', 'water', 'tax', 'discount allowed'];
    const equityKeywords = ['capital', 'equity', 'drawing', 'drawings', 'share capital', 'retained earnings'];
    const liabilityKeywords = ['payable', 'creditor', 'creditors', 'loan', 'borrowing', 'overdraft', 'liability', 'liabilities', 'duty', 'duties', 'tax payable', 'outstanding', 'unearned'];
    const assetKeywords = ['cash', 'bank', 'receivable', 'debtor', 'debtors', 'inventory', 'stock', 'equipment', 'machinery', 'building', 'land', 'furniture', 'fixtures', 'vehicle', 'asset', 'prepaid', 'investment'];

    function classifyAccount(accName) {
        const lower = accName.toLowerCase();
        if (equityKeywords.some(k => lower.includes(k))) return 'equity';
        if (incomeKeywords.some(k => lower.includes(k))) return 'income';
        if (expenseKeywords.some(k => lower.includes(k))) return 'expense';
        if (liabilityKeywords.some(k => lower.includes(k))) return 'liability';
        if (assetKeywords.some(k => lower.includes(k))) return 'asset';
        return 'unclassified';
    }

    let totalIncome = 0;
    let totalExpenses = 0;
    const isIncomeRows = [];
    const isExpenseRows = [];

    const bsAssetRows = [];
    const bsLiabilityRows = [];
    const bsEquityRows = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    Object.entries(accounts).forEach(([acc, { debit, credit }]) => {
        const type = classifyAccount(acc);
        const netDebit = debit - credit;
        const netCredit = credit - debit;

        if (type === 'income') {
            const amt = netCredit > 0 ? netCredit : -netDebit;
            totalIncome += amt;
            isIncomeRows.push({ label: acc, amount: amt });
        } else if (type === 'expense') {
            const amt = netDebit > 0 ? netDebit : -netCredit;
            totalExpenses += amt;
            isExpenseRows.push({ label: acc, amount: amt });
        } else if (type === 'equity') {
            const isDrawing = acc.toLowerCase().includes('drawing');
            const amt = isDrawing ? (netDebit > 0 ? -netDebit : netCredit) : (netCredit > 0 ? netCredit : -netDebit);
            totalEquity += amt;
            bsEquityRows.push({ label: acc, amount: amt });
        } else if (type === 'liability') {
            const amt = netCredit > 0 ? netCredit : -netDebit;
            if (amt !== 0) {
                totalLiabilities += amt;
                bsLiabilityRows.push({ label: acc, amount: amt });
            }
        } else if (type === 'asset') {
            const amt = netDebit > 0 ? netDebit : -netCredit;
            if (amt !== 0) {
                totalAssets += amt;
                bsAssetRows.push({ label: acc, amount: amt });
            }
        } else {
            // Unclassified: default based on normal balance
            if (netDebit > 0) {
                totalAssets += netDebit;
                bsAssetRows.push({ label: acc, amount: netDebit });
            } else if (netCredit > 0) {
                totalLiabilities += netCredit;
                bsLiabilityRows.push({ label: acc, amount: netCredit });
            }
        }
    });

    // 2. Render Income Statement
    const isTbody = document.querySelector('#is-table tbody');
    if (isTbody) {
        let isHtml = `
            <tr style="background:var(--bg-tertiary);"><td colspan="2"><strong>Revenues / Income</strong></td></tr>
        `;
        if (isIncomeRows.length === 0) {
            isHtml += `<tr><td colspan="2" style="text-align:center;color:var(--text-secondary);">No revenue entries</td></tr>`;
        } else {
            isIncomeRows.forEach(r => {
                isHtml += `<tr><td style="padding-left:1.5rem;">${r.label}</td><td style="text-align:right;">${fmt(r.amount)}</td></tr>`;
            });
        }
        isHtml += `<tr><td><strong>Total Revenue</strong></td><td style="text-align:right;"><strong>${fmt(totalIncome)}</strong></td></tr>`;

        isHtml += `
            <tr style="background:var(--bg-tertiary);"><td colspan="2"><strong>Operating Expenses</strong></td></tr>
        `;
        if (isExpenseRows.length === 0) {
            isHtml += `<tr><td colspan="2" style="text-align:center;color:var(--text-secondary);">No expense entries</td></tr>`;
        } else {
            isExpenseRows.forEach(r => {
                isHtml += `<tr><td style="padding-left:1.5rem;">${r.label}</td><td style="text-align:right;">${fmt(r.amount)}</td></tr>`;
            });
        }
        isHtml += `<tr><td><strong>Total Expenses</strong></td><td style="text-align:right;"><strong>${fmt(totalExpenses)}</strong></td></tr>`;

        isTbody.innerHTML = isHtml;
    }

    const netPL = totalIncome - totalExpenses;
    const isResult = document.getElementById('is-result');
    if (isResult) {
        isResult.style.background = netPL >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
        isResult.style.color = netPL >= 0 ? 'var(--success)' : 'var(--danger)';
        isResult.textContent = `Net ${netPL >= 0 ? 'Profit' : 'Loss'}: ${fmt(Math.abs(netPL))}`;
    }

    // 3. Render Balance Sheet
    const bsTbody = document.querySelector('#bs-table tbody');
    if (bsTbody) {
        let bsHtml = `
            <tr style="background:var(--bg-tertiary);"><td colspan="2"><strong>ASSETS</strong></td></tr>
        `;
        if (bsAssetRows.length === 0) {
            bsHtml += `<tr><td colspan="2" style="text-align:center;color:var(--text-secondary);">No asset entries</td></tr>`;
        } else {
            bsAssetRows.forEach(r => {
                bsHtml += `<tr><td style="padding-left:1.5rem;">${r.label}</td><td style="text-align:right;">${fmt(r.amount)}</td></tr>`;
            });
        }
        bsHtml += `<tr style="border-top:1px solid var(--border);"><td><strong>Total Assets</strong></td><td style="text-align:right;color:var(--accent);"><strong>${fmt(totalAssets)}</strong></td></tr>`;

        bsHtml += `
            <tr style="background:var(--bg-tertiary);"><td colspan="2"><strong>LIABILITIES</strong></td></tr>
        `;
        if (bsLiabilityRows.length === 0) {
            bsHtml += `<tr><td colspan="2" style="text-align:center;color:var(--text-secondary);">No liability entries</td></tr>`;
        } else {
            bsLiabilityRows.forEach(r => {
                bsHtml += `<tr><td style="padding-left:1.5rem;">${r.label}</td><td style="text-align:right;">${fmt(r.amount)}</td></tr>`;
            });
        }
        bsHtml += `<tr style="border-top:1px solid var(--border);"><td><strong>Total Liabilities</strong></td><td style="text-align:right;"><strong>${fmt(totalLiabilities)}</strong></td></tr>`;

        bsHtml += `
            <tr style="background:var(--bg-tertiary);"><td colspan="2"><strong>OWNER'S EQUITY</strong></td></tr>
        `;
        if (bsEquityRows.length === 0 && netPL === 0) {
            bsHtml += `<tr><td colspan="2" style="text-align:center;color:var(--text-secondary);">No equity entries</td></tr>`;
        } else {
            bsEquityRows.forEach(r => {
                bsHtml += `<tr><td style="padding-left:1.5rem;">${r.label}</td><td style="text-align:right;">${fmt(r.amount)}</td></tr>`;
            });
            bsHtml += `<tr><td style="padding-left:1.5rem;">Retained Earnings (Net Income)</td><td style="text-align:right;">${fmt(netPL)}</td></tr>`;
        }
        const totalEquityAndEarnings = totalEquity + netPL;
        bsHtml += `<tr style="border-top:1px solid var(--border);"><td><strong>Total Equity</strong></td><td style="text-align:right;"><strong>${fmt(totalEquityAndEarnings)}</strong></td></tr>`;

        const totalLiabAndEquity = totalLiabilities + totalEquityAndEarnings;
        bsHtml += `
            <tr style="background:rgba(59,130,246,0.15);border-top:2px solid var(--accent);font-weight:bold;">
                <td><strong>TOTAL LIABILITIES & EQUITY</strong></td>
                <td style="text-align:right;color:var(--accent);"><strong>${fmt(totalLiabAndEquity)}</strong></td>
            </tr>
        `;

        bsTbody.innerHTML = bsHtml;
    }

    const totalLiabAndEquity = totalLiabilities + totalEquity + netPL;
    const bsResult = document.getElementById('bs-result');
    if (bsResult) {
        const isBalanced = Math.abs(totalAssets - totalLiabAndEquity) < 0.01;
        bsResult.style.display = 'flex';
        bsResult.style.justifyContent = 'space-between';
        bsResult.style.alignItems = 'center';
        bsResult.style.background = isBalanced ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
        bsResult.style.color = isBalanced ? 'var(--success)' : 'var(--danger)';
        bsResult.innerHTML = `
            <span>Total Assets: <strong>${fmt(totalAssets)}</strong></span>
            <span>${isBalanced ? '✓ Balanced' : '⚠ Difference: ' + fmt(Math.abs(totalAssets - totalLiabAndEquity))}</span>
            <span>Total Liab & Equity: <strong>${fmt(totalLiabAndEquity)}</strong></span>
        `;
    }
}

function importJsonFile(file, onSuccess) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed.pos && !parsed.journal && !parsed.inventory) {
                alert('Invalid data file format. Expected JSON with pos, journal, or inventory.');
                return;
            }
            if (confirm(`Restore data containing ${parsed.pos ? parsed.pos.length : 0} bills and ${parsed.journal ? parsed.journal.length : 0} journal entries? This will update your local data and sync to GitHub.`)) {
                appData = {
                    inventory: parsed.inventory || appData.inventory || [],
                    pos: parsed.pos || appData.pos || [],
                    journal: parsed.journal || appData.journal || [],
                    nextInvoice: parsed.nextInvoice || getNextInvoiceNumber()
                };
                ensureIds();
                saveLocal();
                await syncData();
                alert('✓ Data successfully imported and synchronized to GitHub!');
                if (onSuccess) onSuccess();
                const hash = location.hash.replace('#', '') || 'dashboard';
                navigateTo(hash, false);
            }
        } catch (err) {
            alert('Failed to parse JSON file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// =============================================
// SETTINGS
// =============================================
function initSettingsView() {
    document.getElementById('gh-pat').value = settings.pat || '';
    document.getElementById('gh-owner').value = settings.owner || '';
    document.getElementById('gh-repo').value = settings.repo || '';
    document.getElementById('gh-path').value = settings.path || 'data.json';
    const termInput = document.getElementById('gh-terminal');
    if (termInput) termInput.value = settings.terminal || localStorage.getItem('udaanTerminal') || 'Counter 1';

    document.getElementById('save-settings-btn').addEventListener('click', () => {
        const terminalVal = document.getElementById('gh-terminal') ? document.getElementById('gh-terminal').value.trim() : 'Counter 1';
        localStorage.setItem('udaanTerminal', terminalVal || 'Counter 1');
        settings = {
            pat: document.getElementById('gh-pat').value.trim(),
            owner: document.getElementById('gh-owner').value.trim() || 'Tanmay201010',
            repo: document.getElementById('gh-repo').value.trim() || 'udaan',
            path: document.getElementById('gh-path').value.trim() || 'data.json',
            terminal: terminalVal || 'Counter 1'
        };
        localStorage.setItem('udaanSettings', JSON.stringify(settings));
        const msgEl = document.getElementById('settings-msg');
        if (msgEl) {
            msgEl.innerHTML = '<p style="color:var(--success);">Settings saved! Testing connection...</p>';
        }
        testGitHubConnection();
    });

    // Backup Download
    const backupDownBtn = document.getElementById('backup-download-btn');
    if (backupDownBtn) {
        backupDownBtn.addEventListener('click', () => {
            const dataStr = JSON.stringify(appData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `udaan_backup_${today()}.json`;
            a.click();
        });
    }

    // Backup Restore / Import
    const backupImportBtn = document.getElementById('backup-import-btn');
    const backupFileInput = document.getElementById('backup-file-input');
    if (backupImportBtn && backupFileInput) {
        backupImportBtn.addEventListener('click', () => backupFileInput.click());
        backupFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                importJsonFile(file, () => {
                    initSettingsView();
                });
            }
        });
    }
}

// =============================================
// GITHUB SYNC
// =============================================
function updateSyncStatus(msg, type) {
    const text = document.getElementById('sync-status-text');
    const indicator = document.querySelector('.sync-status .status-indicator');
    if (text) text.textContent = msg;
    if (indicator) {
        indicator.className = 'status-indicator';
        if (type === 'ok') indicator.style.background = 'var(--success)';
        else if (type === 'warning') indicator.style.background = '#f59e0b';
        else if (type === 'error') indicator.style.background = 'var(--danger)';
        else indicator.style.background = 'var(--text-secondary)';
    }
}

function decodeBase64Utf8(base64Str) {
    if (!base64Str) return '';
    const cleanB64 = base64Str.replace(/\s/g, '');
    let str = '';
    try {
        const binStr = atob(cleanB64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
            bytes[i] = binStr.charCodeAt(i);
        }
        str = new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        try {
            str = decodeURIComponent(escape(atob(cleanB64)));
        } catch (e2) {
            str = atob(cleanB64);
        }
    }
    // Remove Byte Order Mark (BOM) / zero-width characters at start of string
    return str.replace(/^\uFEFF/, '').trim();
}

function encodeBase64Utf8(str) {
    try {
        const bytes = new TextEncoder().encode(str);
        let binStr = '';
        for (let i = 0; i < bytes.length; i++) {
            binStr += String.fromCharCode(bytes[i]);
        }
        return btoa(binStr);
    } catch (e) {
        return btoa(unescape(encodeURIComponent(str)));
    }
}

async function fetchFromGitHub(refreshView = true) {
    if (!settings.pat || !settings.owner || !settings.repo) return;
    updateSyncStatus('Syncing...', 'warning');
    try {
        const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${settings.path || 'data.json'}`;
        const res = await fetch(url, { headers: { Authorization: `token ${settings.pat}`, Accept: 'application/vnd.github.v3+json' } });
        if (!res.ok) {
            if (res.status === 404) {
                updateSyncStatus('File not found on GitHub — will create on next save.', 'warning');
                return;
            }
            throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        currentSha = json.sha;
        const decoded = decodeBase64Utf8(json.content);
        
        let data = { inventory: [], pos: [], journal: [], nextInvoice: 1 };
        if (decoded && decoded !== '') {
            data = JSON.parse(decoded);
        }

        // Smart merge POS bills (union by unique ID without dropping any sales)
        const localBills = appData.pos || [];
        const remoteBills = data.pos || [];
        const billMap = new Map();
        [...remoteBills, ...localBills].forEach(b => {
            if (!b.id) b.id = uid();
            billMap.set(String(b.id), b);
        });

        const mergedBills = Array.from(billMap.values());
        const invoiceNoSeen = new Set();
        mergedBills.forEach(b => {
            if (!b.invoiceNo) {
                b.invoiceNo = '#' + String(getNextInvoiceNumber()).padStart(6, '0');
            }
            if (invoiceNoSeen.has(b.invoiceNo)) {
                const termTag = b.terminal ? b.terminal.replace(/\s+/g, '') : 'dup';
                b.invoiceNo = `${b.invoiceNo}-${termTag}`;
            }
            invoiceNoSeen.add(b.invoiceNo);
        });

        // Smart merge Journal entries by unique ID
        const localJournal = appData.journal || [];
        const remoteJournal = data.journal || [];
        const jMap = new Map();
        [...remoteJournal, ...localJournal].forEach(j => {
            if (!j.id) j.id = uid();
            jMap.set(String(j.id), j);
        });

        // Inventory
        const inventory = data.inventory && data.inventory.length > 0 ? data.inventory : (appData.inventory || []);

        appData = {
            inventory: inventory,
            pos: mergedBills,
            journal: Array.from(jMap.values()),
            nextInvoice: Math.max(data.nextInvoice || 1, getNextInvoiceNumber())
        };
        ensureIds();
        saveLocal();
        updateSyncStatus('Synced from GitHub ✓', 'ok');

        if (refreshView) {
            const hash = location.hash.replace('#', '') || 'dashboard';
            navigateTo(hash, false);
        }
    } catch (err) {
        updateSyncStatus('Sync error: ' + err.message, 'error');
    }
}

async function syncData() {
    if (!settings.pat || !settings.owner || !settings.repo) {
        updateSyncStatus('Not configured', 'warning');
        return;
    }
    updateSyncStatus('Saving...', 'warning');
    try {
        const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${settings.path || 'data.json'}`;
        const jsonStr = JSON.stringify(appData, null, 2);
        const content = encodeBase64Utf8(jsonStr);
        const body = { message: 'UdaanPro data update', content };
        if (currentSha) body.sha = currentSha;
        
        let res = await fetch(url, {
            method: 'PUT',
            headers: { Authorization: `token ${settings.pat}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
            body: JSON.stringify(body)
        });

        // If 409 Conflict, re-fetch the latest sha and retry once
        if (res.status === 409) {
            const getRes = await fetch(url, { headers: { Authorization: `token ${settings.pat}`, Accept: 'application/vnd.github.v3+json' } });
            if (getRes.ok) {
                const getJson = await getRes.json();
                currentSha = getJson.sha;
                body.sha = currentSha;
                res = await fetch(url, {
                    method: 'PUT',
                    headers: { Authorization: `token ${settings.pat}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
                    body: JSON.stringify(body)
                });
            }
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        currentSha = json.content ? json.content.sha : json.sha;
        updateSyncStatus('Saved to GitHub ✓', 'ok');
    } catch (err) {
        updateSyncStatus('Save error: ' + err.message, 'error');
    }
}

async function testGitHubConnection() {
    await fetchFromGitHub();
    const msgEl = document.getElementById('settings-msg');
    if (msgEl) {
        const statusText = document.getElementById('sync-status-text');
        const msg = statusText ? statusText.textContent : '';
        if (msg.includes('Synced') || msg.includes('not found')) {
            msgEl.innerHTML = '<p style="color:var(--success);">✓ Connection successful! Settings saved.</p>';
        } else {
            msgEl.innerHTML = `<p style="color:var(--danger);">Connection issue: ${msg}</p>`;
        }
    }
}

// =============================================
// BOOT
// =============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
