# Design Document: Expense and Budget Visualizer

## Overview

The Expense and Budget Visualizer is a single-page, client-side web application built with plain HTML, CSS, and vanilla JavaScript. It allows users to record personal expense transactions, review them in a scrollable list, monitor a running total balance, and visualize spending by category through a live-updating pie chart. All data is persisted in the browser's Local Storage so the history survives page reloads and browser restarts.

The application ships as three files:

```
index.html          ← page structure and CDN script tags
css/styles.css      ← all styling
js/app.js           ← all behavior
```

No build step, no server, no package manager. The page can be opened directly from the file system (`file://`) or served from any static host.

### Key Design Decisions

- **Single JS file**: All logic lives in `js/app.js`. Modules are simulated through clearly separated function groups (storage, validation, rendering, chart) rather than ES modules, to preserve `file://` compatibility without a server.
- **Chart.js via CDN**: Loaded with a `<script>` tag in `index.html`. The chart instance is created once and updated in-place via `chart.data` mutations followed by `chart.update()`, avoiding full re-renders.
- **Immutable transaction IDs**: Each transaction receives a `Date.now()` timestamp as its `id` at creation time. Deletion uses this id to splice the in-memory array, then re-persists.
- **Defensive Local Storage access**: All reads and writes are wrapped in `try/catch`. On failure the app falls back to an empty list and shows a non-blocking banner.

---

## Architecture

The application follows a simple **data → render** loop with no reactive framework. Every user action (add, delete) mutates a single in-memory array (`transactions`), persists it, then calls a top-level `render()` function that redraws all three output components (list, balance, chart) from scratch.

```mermaid
flowchart TD
    A[User Action\nadd / delete] --> B[Validate Input]
    B -->|invalid| C[Show inline error]
    B -->|valid| D[Mutate transactions array]
    D --> E[Persist to Local Storage]
    E --> F[render()]
    F --> G[renderList()]
    F --> H[renderBalance()]
    F --> I[renderChart()]
    J[Page Load] --> K[loadFromStorage()]
    K --> F
```

### Module Boundaries (within app.js)

| Section | Responsibility |
|---|---|
| **Storage** | `loadTransactions()`, `saveTransactions()` — read/write Local Storage |
| **Validation** | `validateForm(name, amount, category)` — returns `{valid, errors}` |
| **State** | `transactions` array, `chartInstance` reference |
| **Rendering** | `render()`, `renderList()`, `renderBalance()`, `renderChart()` |
| **Event Handlers** | Form submit, delete button clicks (event delegation) |
| **Init** | `init()` — called on `DOMContentLoaded` |

---

## Components and Interfaces

### index.html Structure

```
<body>
  <header>
    <h1>Expense & Budget Visualizer</h1>
    <div id="balance-display">Total: $0.00</div>
    <div id="storage-error-banner" hidden>…</div>
  </header>

  <main>
    <section id="form-section">
      <form id="expense-form">
        <input  id="item-name"   type="text"   placeholder="Item name" />
        <input  id="item-amount" type="number" placeholder="Amount"    min="0.01" step="0.01" />
        <select id="item-category">
          <option value="">Select category</option>
          <option value="Food">Food</option>
          <option value="Transport">Transport</option>
          <option value="Fun">Fun</option>
        </select>
        <button type="submit">Add</button>
        <div id="form-errors" aria-live="polite"></div>
      </form>
    </section>

    <section id="list-section">
      <h2>Transactions</h2>
      <ul id="transaction-list"></ul>
    </section>

    <section id="chart-section">
      <h2>Spending by Category</h2>
      <div id="chart-container">
        <canvas id="spending-chart"></canvas>
        <p id="chart-empty-message" hidden>No transactions yet.</p>
      </div>
    </section>
  </main>
</body>
```

### JavaScript Public Interface (app.js)

All functions are module-private (no exports needed). The public surface is the event listeners wired in `init()`.

```
init()
  └─ loadTransactions() → transactions[]
  └─ render()
       ├─ renderList(transactions)
       ├─ renderBalance(transactions)
       └─ renderChart(transactions, chartInstance)

handleFormSubmit(event)
  └─ validateForm(name, amount, category) → {valid, errors}
  └─ addTransaction(name, amount, category)
       ├─ saveTransactions(transactions)
       └─ render()

handleDeleteClick(id)
  └─ deleteTransaction(id)
       ├─ saveTransactions(transactions)
       └─ render()
```

### Chart.js Integration

- **Library**: Chart.js 4.x loaded via CDN (`<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`)
- **Instance lifecycle**: Created once in `init()` after the canvas is in the DOM; stored in `chartInstance`.
- **Update strategy**: `renderChart()` mutates `chartInstance.data.datasets[0].data` and `chartInstance.data.labels`, then calls `chartInstance.update()`. This avoids destroying and recreating the canvas on every change.
- **Empty state**: When `transactions` is empty, the canvas is hidden and `#chart-empty-message` is shown.

---

## Data Models

### Transaction Object

```js
{
  id:       number,   // Date.now() at creation — unique identifier
  name:     string,   // item name, non-empty, trimmed
  amount:   number,   // positive float, stored as JS number
  category: string    // "Food" | "Transport" | "Fun"
}
```

### Local Storage Schema

- **Key**: `"expense_transactions"`
- **Value**: JSON-serialized array of Transaction objects

```json
[
  { "id": 1700000000000, "name": "Lunch", "amount": 12.50, "category": "Food" },
  { "id": 1700000001000, "name": "Bus pass", "amount": 30.00, "category": "Transport" }
]
```

### Validation Result Object

```js
{
  valid:  boolean,
  errors: string[]   // human-readable messages, empty when valid
}
```

### Category Color Map

```js
const CATEGORY_COLORS = {
  Food:      "#FF6384",
  Transport: "#36A2EB",
  Fun:       "#FFCE56"
};
```

Colors are fixed constants — consistent across all renders and sessions.

### Chart Data Shape (passed to Chart.js)

```js
{
  labels:   ["Food", "Transport", "Fun"],
  datasets: [{
    data:            [totalFood, totalTransport, totalFun],
    backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"]
  }]
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Validator rejects any invalid input combination

*For any* combination of inputs where at least one of the following is true — the item name is empty or composed entirely of whitespace, the amount is zero, negative, or non-numeric, or no category is selected — the validator SHALL return `valid: false` and no transaction SHALL be added to the list.

**Validates: Requirements 1.2, 1.3**

---

### Property 2: Adding a valid transaction grows the list by exactly one and persists it

*For any* transaction list of length N and any valid transaction (non-empty trimmed name, positive numeric amount, valid category), adding that transaction SHALL produce a list of length N + 1, the new transaction SHALL appear at index 0 (most recent first), and Local Storage SHALL contain the updated list.

**Validates: Requirements 1.4, 2.3**

---

### Property 3: Form resets after every successful submission

*For any* valid form submission, after the transaction is added the item name field, amount field, and category selector SHALL all return to their default empty/unselected state.

**Validates: Requirements 1.5**

---

### Property 4: Rendered list contains all transaction data for every entry

*For any* transaction list, the rendered Transaction_List HTML SHALL contain the item name, amount, and category for every transaction in the list — no entry is omitted or truncated.

**Validates: Requirements 2.1**

---

### Property 5: Deleting a transaction removes exactly that entry and no others

*For any* transaction list containing a transaction with a given `id`, deleting by that `id` SHALL produce a list that does not contain the deleted transaction and retains all other transactions in their original order.

**Validates: Requirements 2.5**

---

### Property 6: Balance always equals the arithmetic sum of all transaction amounts

*For any* transaction list (including the empty list), the computed balance SHALL equal the sum of the `amount` fields of every transaction in the list. This invariant holds after every addition, deletion, and on initial load.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

### Property 7: Chart data values equal per-category amount sums

*For any* transaction list, the data value supplied to the pie chart for each category (Food, Transport, Fun) SHALL equal the sum of `amount` for all transactions whose `category` matches that label.

**Validates: Requirements 4.1, 4.2, 4.3**

---

### Property 8: Serialization round-trip preserves all transaction fields

*For any* transaction list, serializing it to a JSON string and then deserializing that string SHALL produce a list that is deeply equal to the original — same length, and identical `id`, `name`, `amount`, and `category` for every entry.

**Validates: Requirements 5.1, 5.2**

---

### Property 9: Application initialization fully restores persisted state

*For any* transaction list previously saved to Local Storage, running `init()` SHALL restore the Transaction_List, Balance_Display, and chart data to values that are consistent with the persisted transactions — the list contains all saved transactions, the balance equals their sum, and the chart data equals the per-category sums.

**Validates: Requirements 5.3**

---

## Error Handling

### Validation Errors

- Triggered when the user submits the form with missing or invalid fields.
- Error messages are written into `#form-errors` (an `aria-live="polite"` region so screen readers announce them).
- Messages are cleared on the next successful submission or when the user begins editing a field.
- No transaction is created; the form retains the user's input so they can correct it.

### Local Storage Errors

- All `localStorage.getItem` / `localStorage.setItem` calls are wrapped in `try/catch`.
- On read failure (unavailable API, malformed JSON): the app initializes with an empty `transactions` array and reveals `#storage-error-banner` with the message "Could not load saved data. Starting fresh."
- On write failure: the in-memory state is still updated and rendered; a console warning is emitted. The banner is not shown for write failures to avoid alarming the user on every interaction in restricted environments.

### Chart.js Load Failure

- If the CDN script fails to load, `window.Chart` will be undefined.
- `init()` checks for `window.Chart` before creating the chart instance. If absent, the chart section is hidden and a static message "Chart unavailable — could not load charting library." is shown.

### Invalid Transaction IDs

- If a delete event fires with an `id` that does not match any transaction (e.g., stale DOM), the `deleteTransaction()` function performs a no-op and logs a warning. No state mutation occurs.

---

## Testing Strategy

This feature is a client-side vanilla JS application. Property-based testing applies to the pure logic functions (validation, balance calculation, chart data aggregation, Local Storage serialization). UI rendering and Chart.js integration are covered by example-based tests.

### Unit Tests (example-based)

Focus on concrete scenarios and edge cases:

- `validateForm`: empty name, whitespace-only name, zero amount, negative amount, missing category, all valid inputs.
- `renderBalance`: empty list returns `$0.00`; list with mixed amounts returns correct formatted sum.
- `renderChart` empty state: canvas hidden, empty message shown.
- `deleteTransaction`: deleting the only item leaves an empty list; deleting a middle item preserves order of remaining items.
- Local Storage fallback: malformed JSON triggers empty-list initialization and banner display.

### Property-Based Tests

Use a property-based testing library (e.g., [fast-check](https://github.com/dubzzz/fast-check) for JavaScript) with a minimum of **100 iterations per property**.

Each test is tagged with the corresponding design property:

| Tag format | `// Feature: expense-budget-visualizer, Property N: <property text>` |
|---|---|

**Properties to implement:**

- **Property 1** — Generate combinations of invalid inputs (whitespace names, non-positive amounts, missing category); assert `validateForm` returns `valid: false` and transaction list is unchanged.
- **Property 2** — Generate random lists of length N and one valid transaction; assert list grows to N+1 and new item is at index 0, and Local Storage contains the updated list.
- **Property 3** — Generate valid form inputs; assert that after successful submission all form fields are empty/reset.
- **Property 4** — Generate random transaction lists; assert rendered HTML contains name, amount, and category for every transaction.
- **Property 5** — Generate a random list with at least one transaction; pick a random `id`; assert post-delete list excludes that id and all others are preserved in order.
- **Property 6** — Generate random transaction lists; assert `computeBalance(transactions)` equals `transactions.reduce((s, t) => s + t.amount, 0)`.
- **Property 7** — Generate random transaction lists; assert chart data values for each category equal the filtered sum of amounts for that category.
- **Property 8** — Generate random transaction lists; assert `deserialize(serialize(list))` deep-equals the original list.
- **Property 9** — Generate random lists; save to Local Storage; re-run `init()`; assert restored list, balance, and chart data all match the original.

### Integration / Smoke Tests

- Page loads without JS errors in Chrome, Firefox, Edge, and Safari.
- Persisted data survives a simulated page reload (write to Local Storage, re-run `init()`, assert list is restored).
- Chart.js CDN unavailability: stub `window.Chart = undefined`, run `init()`, assert fallback message is shown.

### Accessibility

- Contrast ratios for all text/background combinations verified against WCAG 2.1 AA (minimum 4.5:1 for normal text, 3:1 for large text).
- `aria-live` region on `#form-errors` verified to announce validation messages.
- All interactive controls (form fields, buttons, delete controls) verified to be keyboard-navigable and have visible focus indicators.

> **Note**: Full WCAG compliance requires manual testing with assistive technologies (screen readers, keyboard-only navigation) and expert accessibility review in addition to automated contrast checks.
