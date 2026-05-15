// Feature: expense-budget-visualizer
// Module-level state

const CATEGORY_COLORS = {
  Food:      "#FF6384",
  Transport: "#36A2EB",
  Fun:       "#FFCE56"
};

let transactions = [];
let chartInstance = null;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * Reads the transaction list from Local Storage.
 * Returns the parsed array on success.
 * On any error (unavailable API, malformed JSON, etc.) reveals the
 * #storage-error-banner and returns an empty array.
 *
 * @returns {Array} Parsed transaction array, or [] on failure.
 */
function loadTransactions() {
  try {
    const raw = localStorage.getItem("expense_transactions");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    const banner = document.getElementById("storage-error-banner");
    if (banner) {
      banner.removeAttribute("hidden");
    }
    return [];
  }
}

/**
 * Serializes the given transaction list and writes it to Local Storage.
 * On write failure logs a console warning (does NOT show the banner).
 *
 * @param {Array} list - The transaction array to persist.
 */
function saveTransactions(list) {
  try {
    localStorage.setItem("expense_transactions", JSON.stringify(list));
  } catch (err) {
    console.warn("Could not save transactions to Local Storage:", err);
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = ["Food", "Transport", "Fun"];

/**
 * Validates the three form fields before a transaction is created.
 *
 * Rules:
 *   - name   : must be non-empty after trimming whitespace
 *   - amount : must be a finite, positive number (> 0)
 *   - category: must be one of "Food", "Transport", "Fun"
 *
 * @param {string} name     - Raw value from the item-name input.
 * @param {string|number} amount   - Raw value from the item-amount input.
 * @param {string} category - Selected value from the item-category select.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateForm(name, amount, category) {
  const errors = [];

  // Validate name
  if (typeof name !== "string" || name.trim() === "") {
    errors.push("Item name is required.");
  }

  // Validate amount: must be a finite number greater than zero
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
    errors.push("Amount must be a positive number.");
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(category)) {
    errors.push("Please select a category (Food, Transport, or Fun).");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Sums all transaction amounts and writes the formatted total into
 * #balance-display. Shows "$0.00" when the list is empty.
 *
 * @param {Array} list - The current transaction array.
 */
function renderBalance(list) {
  const total = list.reduce((sum, t) => sum + t.amount, 0);
  const display = document.getElementById("balance-display");
  if (display) {
    display.textContent = "Total: $" + total.toFixed(2);
  }
}

/**
 * Clears #transaction-list and rebuilds it from the array, newest entry
 * first (index 0 → top of list). Each <li> shows the item name, formatted
 * amount, and category, plus a delete <button> with a data-id attribute.
 *
 * @param {Array} list - The current transaction array.
 */
function renderList(list) {
  const ul = document.getElementById("transaction-list");
  if (!ul) return;

  ul.innerHTML = "";

  list.forEach(function (t) {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.className = "transaction-name";
    nameSpan.textContent = t.name;

    const amountSpan = document.createElement("span");
    amountSpan.className = "transaction-amount";
    amountSpan.textContent = "$" + t.amount.toFixed(2);

    const categorySpan = document.createElement("span");
    categorySpan.className = "transaction-category";
    categorySpan.textContent = t.category;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "delete-btn";
    btn.textContent = "Delete";
    btn.setAttribute("data-id", t.id);
    btn.setAttribute("aria-label", "Delete " + t.name);

    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(categorySpan);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

/**
 * Updates the pie chart to reflect per-category totals.
 *
 * - Empty list: hides <canvas>, shows #chart-empty-message, zeroes chart data.
 * - Non-empty list: shows <canvas>, hides #chart-empty-message, mutates
 *   instance.data and calls instance.update().
 *
 * @param {Array}  list     - The current transaction array.
 * @param {object} instance - The Chart.js chart instance (may be null).
 */
function renderChart(list, instance) {
  const canvas = document.getElementById("spending-chart");
  const emptyMsg = document.getElementById("chart-empty-message");

  // Compute per-category totals
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  list.forEach(function (t) {
    if (Object.prototype.hasOwnProperty.call(totals, t.category)) {
      totals[t.category] += t.amount;
    }
  });

  const labels = ["Food", "Transport", "Fun"];
  const data   = [totals.Food, totals.Transport, totals.Fun];

  if (list.length === 0) {
    // Empty state: hide canvas, show placeholder message
    if (canvas)   canvas.hidden = true;
    if (emptyMsg) emptyMsg.hidden = false;

    if (instance) {
      instance.data.labels = labels;
      instance.data.datasets[0].data = [0, 0, 0];
      instance.update();
    }
  } else {
    // Non-empty: show canvas, hide placeholder message
    if (canvas)   canvas.hidden = false;
    if (emptyMsg) emptyMsg.hidden = true;

    if (instance) {
      instance.data.labels = labels;
      instance.data.datasets[0].data = data;
      instance.update();
    }
  }
}

/**
 * Top-level render: redraws the list, balance, and chart from the current
 * module-level `transactions` array and `chartInstance`.
 */
function render() {
  renderList(transactions);
  renderBalance(transactions);
  renderChart(transactions, chartInstance);
}

// ---------------------------------------------------------------------------
// Transaction Mutations
// ---------------------------------------------------------------------------

/**
 * Creates a new transaction object and prepends it to the transactions array
 * (most recent first), then persists and re-renders.
 *
 * @param {string} name     - Item name (will be trimmed).
 * @param {string|number} amount   - Expense amount (will be parsed as float).
 * @param {string} category - One of "Food", "Transport", "Fun".
 */
function addTransaction(name, amount, category) {
  const transaction = {
    id:       Date.now(),
    name:     name.trim(),
    amount:   parseFloat(amount),
    category: category
  };

  transactions.unshift(transaction);
  saveTransactions(transactions);
  render();
}

/**
 * Removes the transaction with the given id from the transactions array,
 * then persists and re-renders. Logs a warning and returns early if no
 * matching transaction is found.
 *
 * @param {number} id - The id of the transaction to remove.
 */
function deleteTransaction(id) {
  const index = transactions.findIndex(function (t) { return t.id === id; });

  if (index === -1) {
    console.warn("deleteTransaction: no transaction found with id", id);
    return;
  }

  transactions = transactions.filter(function (t) { return t.id !== id; });
  saveTransactions(transactions);
  render();
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

/**
 * Handles the expense form's submit event.
 *
 * Steps:
 *   1. Prevents the default browser form submission.
 *   2. Reads the current values from #item-name, #item-amount, #item-category.
 *   3. Runs validateForm(); on failure writes each error message into
 *      #form-errors and returns without adding a transaction.
 *   4. On success clears #form-errors, calls addTransaction(), then resets
 *      all form fields to their default empty/unselected state.
 *
 * @param {Event} event - The form submit event.
 */
function handleFormSubmit(event) {
  event.preventDefault();

  const nameInput     = document.getElementById("item-name");
  const amountInput   = document.getElementById("item-amount");
  const categoryInput = document.getElementById("item-category");
  const formErrors    = document.getElementById("form-errors");

  const name     = nameInput     ? nameInput.value     : "";
  const amount   = amountInput   ? amountInput.value   : "";
  const category = categoryInput ? categoryInput.value : "";

  const { valid, errors } = validateForm(name, amount, category);

  if (!valid) {
    if (formErrors) {
      formErrors.textContent = errors.join(" ");
    }
    return;
  }

  // Clear any previous error messages
  if (formErrors) {
    formErrors.textContent = "";
  }

  addTransaction(name, amount, category);

  // Reset all form fields to their default empty/unselected state
  if (nameInput)     nameInput.value     = "";
  if (amountInput)   amountInput.value   = "";
  if (categoryInput) categoryInput.value = "";
}

/**
 * Handles click events on #transaction-list via event delegation.
 * When the clicked element is a delete button (has a data-id attribute),
 * parses the id and calls deleteTransaction().
 *
 * @param {Event} event - The click event bubbled up from a delete button.
 */
function handleListClick(event) {
  const target = event.target;

  // Only act on delete buttons that carry a data-id attribute
  if (
    target.tagName === "BUTTON" &&
    target.classList.contains("delete-btn") &&
    target.hasAttribute("data-id")
  ) {
    const id = Number(target.getAttribute("data-id"));
    deleteTransaction(id);
  }
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Bootstraps the application.
 *
 * Steps:
 *   1. Loads persisted transactions from Local Storage into the module-level
 *      `transactions` array.
 *   2. Creates the Chart.js chart instance if `window.Chart` is available;
 *      otherwise hides #chart-section and shows a static unavailability message.
 *   3. Calls `render()` to populate the UI from the restored state.
 *   4. Attaches the `submit` listener on #expense-form.
 *   5. Attaches the `click` delegation listener on #transaction-list.
 *
 * Requirements: 2.4, 5.3, 5.4
 */
function init() {
  // Step 1: Restore persisted transactions
  transactions = loadTransactions();

  // Step 2: Set up the chart (or show fallback if Chart.js failed to load)
  if (typeof window !== "undefined" && window.Chart) {
    const canvas = document.getElementById("spending-chart");
    if (canvas) {
      chartInstance = new window.Chart(canvas, {
        type: "doughnut",
        data: {
          labels: ["Food", "Transport", "Fun"],
          datasets: [{
            data: [0, 0, 0],
            backgroundColor: [
              CATEGORY_COLORS.Food,
              CATEGORY_COLORS.Transport,
              CATEGORY_COLORS.Fun
            ]
          }]
        },
        options: { responsive: true }
      });
    }
  } else {
    // Chart.js unavailable — hide the chart section and show a static message
    const chartSection = document.getElementById("chart-section");
    if (chartSection) {
      chartSection.setAttribute("hidden", "");
      const msg = document.createElement("p");
      msg.textContent = "Chart unavailable — could not load charting library.";
      chartSection.appendChild(msg);
    }
  }

  // Step 3: Render the UI from restored state
  render();

  // Step 4: Attach form submit listener
  const expenseForm = document.getElementById("expense-form");
  if (expenseForm) {
    expenseForm.addEventListener("submit", handleFormSubmit);
  }

  // Step 5: Attach delete event delegation to the transaction list
  const transactionList = document.getElementById("transaction-list");
  if (transactionList) {
    transactionList.addEventListener("click", handleListClick);
  }
}

document.addEventListener("DOMContentLoaded", init);

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------
// These tests are self-contained and do NOT run automatically on page load.
// To execute them, call `runPropertyTests()` in the browser console after
// loading fast-check from CDN, or paste the block into a Node.js environment
// that has fast-check installed.
//
// How to run in the browser console:
//   1. Open index.html in a browser.
//   2. In the console, run:
//        const s = document.createElement('script');
//        s.src = 'https://cdn.jsdelivr.net/npm/fast-check@3/lib/bundle/fast-check.min.js';
//        document.head.appendChild(s);
//   3. Wait for the script to load, then call: runPropertyTests()
//
// How to run in Node.js:
//   npm install fast-check
//   node -e "const fc = require('fast-check'); $(cat js/app.js | grep -A9999 'runPropertyTests')"
//   (or copy the runPropertyTests function into a standalone .js file)
// ---------------------------------------------------------------------------

/**
 * Runs all property-based tests for the expense-budget-visualizer.
 * Requires fast-check to be available as `fc` on the global scope (browser)
 * or passed in as an argument (Node.js).
 *
 * @param {object} [fcLib] - Optional fast-check instance. Defaults to window.fc.
 */
function runPropertyTests(fcLib) {
  const fc = fcLib || (typeof window !== "undefined" && window.fc);
  if (!fc) {
    throw new Error(
      "fast-check is not loaded. Load it from CDN or pass it as an argument."
    );
  }

  // -------------------------------------------------------------------------
  // Feature: expense-budget-visualizer, Property 1: Validator rejects any invalid input combination
  // Validates: Requirements 1.2, 1.3
  //
  // For any combination of inputs where at least one of the following is true:
  //   - the item name is empty or composed entirely of whitespace
  //   - the amount is zero, negative, or non-numeric
  //   - no category is selected (value is not one of "Food", "Transport", "Fun")
  // the validator SHALL return valid: false and no transaction SHALL be added.
  // -------------------------------------------------------------------------

  // Arbitrary for invalid names: empty string or whitespace-only strings
  const invalidNameArb = fc.oneof(
    fc.constant(""),
    fc.stringOf(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 1, maxLength: 20 })
  );

  // Arbitrary for invalid amounts: zero, negative numbers, or non-numeric strings
  const invalidAmountArb = fc.oneof(
    fc.constant(0),
    fc.constant("0"),
    fc.constant(-1),
    fc.float({ max: 0, noNaN: true }).filter(n => n <= 0),
    fc.constantFrom("", "abc", "NaN", "Infinity", "-Infinity", null, undefined, "  ")
  );

  // Arbitrary for invalid categories: anything that is not a valid category
  const invalidCategoryArb = fc.oneof(
    fc.constant(""),
    fc.constant(null),
    fc.constant(undefined),
    fc.string().filter(s => !["Food", "Transport", "Fun"].includes(s))
  );

  // Arbitrary for valid names (non-empty after trimming)
  const validNameArb = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);

  // Arbitrary for valid amounts (positive finite numbers or their string representations)
  const validAmountArb = fc.float({ min: 0.01, max: 1e6, noNaN: true }).filter(n => n > 0 && isFinite(n));

  // Arbitrary for valid categories
  const validCategoryArb = fc.constantFrom("Food", "Transport", "Fun");

  // --- Sub-property A: invalid name alone causes rejection ---
  console.log("Running Property 1a: invalid name causes rejection...");
  fc.assert(
    fc.property(
      invalidNameArb,
      validAmountArb,
      validCategoryArb,
      (name, amount, category) => {
        const result = validateForm(name, amount, category);
        return result.valid === false && result.errors.length > 0;
      }
    ),
    { numRuns: 100, verbose: false }
  );
  console.log("  PASSED: invalid name always produces valid: false");

  // --- Sub-property B: invalid amount alone causes rejection ---
  console.log("Running Property 1b: invalid amount causes rejection...");
  fc.assert(
    fc.property(
      validNameArb,
      invalidAmountArb,
      validCategoryArb,
      (name, amount, category) => {
        const result = validateForm(name, amount, category);
        return result.valid === false && result.errors.length > 0;
      }
    ),
    { numRuns: 100, verbose: false }
  );
  console.log("  PASSED: invalid amount always produces valid: false");

  // --- Sub-property C: invalid category alone causes rejection ---
  console.log("Running Property 1c: invalid category causes rejection...");
  fc.assert(
    fc.property(
      validNameArb,
      validAmountArb,
      invalidCategoryArb,
      (name, amount, category) => {
        const result = validateForm(name, amount, category);
        return result.valid === false && result.errors.length > 0;
      }
    ),
    { numRuns: 100, verbose: false }
  );
  console.log("  PASSED: invalid category always produces valid: false");

  // --- Sub-property D: any combination with at least one invalid field causes rejection ---
  // Generate inputs where at least one field is invalid by randomly picking
  // which fields are invalid (at least one must be).
  console.log("Running Property 1d: any combination with at least one invalid field causes rejection...");
  fc.assert(
    fc.property(
      // Pick a non-empty subset of {name, amount, category} to make invalid
      fc.subarray(["name", "amount", "category"], { minLength: 1 }),
      validNameArb,
      validAmountArb,
      validCategoryArb,
      invalidNameArb,
      invalidAmountArb,
      invalidCategoryArb,
      (invalidFields, vName, vAmount, vCategory, iName, iAmount, iCategory) => {
        const name     = invalidFields.includes("name")     ? iName     : vName;
        const amount   = invalidFields.includes("amount")   ? iAmount   : vAmount;
        const category = invalidFields.includes("category") ? iCategory : vCategory;

        const snapshotBefore = transactions.slice();
        const result = validateForm(name, amount, category);

        // Validator must return valid: false
        if (result.valid !== false) return false;
        // errors array must be non-empty
        if (!Array.isArray(result.errors) || result.errors.length === 0) return false;
        // transactions list must be unchanged (validateForm is pure — it never mutates)
        if (transactions.length !== snapshotBefore.length) return false;

        return true;
      }
    ),
    { numRuns: 100, verbose: false }
  );
  console.log("  PASSED: any combination with at least one invalid field always produces valid: false and leaves transactions unchanged");

  console.log("\nAll Property 1 tests passed.");
}
