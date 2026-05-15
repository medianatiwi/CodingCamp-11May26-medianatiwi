# Implementation Plan: Expense and Budget Visualizer

## Overview

Implement a client-side expense tracking web app using only HTML, CSS, and vanilla JavaScript. The app is delivered as three files (`index.html`, `css/styles.css`, `js/app.js`) with no build step, no framework, and no backend. Data persists via Local Storage; Chart.js is loaded from CDN for the pie chart.

## Tasks

- [x] 1. Create the HTML skeleton (`index.html`)
  - Add the `<!DOCTYPE html>` boilerplate, `<head>` with charset, viewport meta, title, and a `<link>` to `css/styles.css`
  - Add a `<script>` tag loading Chart.js 4.x from the jsDelivr CDN (`https://cdn.jsdelivr.net/npm/chart.js`) before the closing `</body>`
  - Add a `<script src="js/app.js" defer></script>` tag
  - Build the `<header>` containing `<h1>`, `#balance-display`, and `#storage-error-banner` (hidden by default)
  - Build `#form-section` with `#expense-form`: `#item-name` (text), `#item-amount` (number, min 0.01, step 0.01), `#item-category` (select with Food / Transport / Fun options plus a blank default), a submit button, and `#form-errors` (`aria-live="polite"`)
  - Build `#list-section` with an `<h2>` and an empty `<ul id="transaction-list">`
  - Build `#chart-section` with an `<h2>`, `<canvas id="spending-chart">`, and `<p id="chart-empty-message">` (hidden by default)
  - _Requirements: 1.1, 2.1, 4.1, 6.1, 6.2, 6.3_

- [x] 2. Write the base CSS (`css/styles.css`)
  - Apply a CSS reset / box-sizing baseline
  - Style the page layout: centered max-width container, header, main sections stacked vertically
  - Style the form: label/input/select/button layout, visible focus rings on all interactive controls
  - Style the transaction list: scrollable container (max-height + overflow-y: auto), each list item showing name, amount, category, and a delete button
  - Style the balance display with a prominent typographic treatment
  - Style the chart container with a fixed height so the canvas does not collapse
  - Ensure all text/background color combinations meet WCAG 2.1 AA contrast (≥ 4.5:1 for normal text, ≥ 3:1 for large text)
  - Style the `#storage-error-banner` as a non-blocking notice (e.g., a muted top banner)
  - _Requirements: 7.3, 7.4, 7.5, 6.1_

- [x] 3. Implement storage and state foundations (`js/app.js`)
  - [x] 3.1 Define the `CATEGORY_COLORS` constant and the `transactions` array (module-level state)
    - `CATEGORY_COLORS = { Food: "#FF6384", Transport: "#36A2EB", Fun: "#FFCE56" }`
    - `let transactions = []`
    - `let chartInstance = null`
    - _Requirements: 4.5, 6.1_

  - [x] 3.2 Implement `loadTransactions()` and `saveTransactions(list)`
    - `loadTransactions()`: wraps `localStorage.getItem("expense_transactions")` in `try/catch`; parses JSON; returns the array or `[]` on any error; reveals `#storage-error-banner` on failure
    - `saveTransactions(list)`: wraps `localStorage.setItem` in `try/catch`; logs a console warning on write failure without showing the banner
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 3.3 Write property test for serialization round-trip
    - **Property 8: Serialization round-trip preserves all transaction fields**
    - **Validates: Requirements 5.1, 5.2**

- [x] 4. Implement form validation (`js/app.js`)
  - [x] 4.1 Implement `validateForm(name, amount, category)`
    - Returns `{ valid: true, errors: [] }` when name is non-empty after trimming, amount is a finite positive number, and category is one of "Food", "Transport", "Fun"
    - Returns `{ valid: false, errors: [...] }` with a human-readable message for each failing field otherwise
    - _Requirements: 1.2, 1.3_

  - [x] 4.2 Write property test for validator rejecting invalid inputs
    - **Property 1: Validator rejects any invalid input combination**
    - **Validates: Requirements 1.2, 1.3**

- [x] 5. Implement rendering functions (`js/app.js`)
  - [x] 5.1 Implement `renderBalance(list)`
    - Sums `amount` across all transactions and writes the formatted value (e.g., `$12.50`) into `#balance-display`
    - Shows `$0.00` when the list is empty
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.2 Write property test for balance computation
    - **Property 6: Balance always equals the arithmetic sum of all transaction amounts**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x] 5.3 Implement `renderList(list)`
    - Clears `#transaction-list` and rebuilds it from the array, newest entry first (index 0 → top of list)
    - Each `<li>` shows the item name, formatted amount, and category
    - Each `<li>` includes a delete `<button>` with a `data-id` attribute set to the transaction's `id`
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 5.4 Write property test for rendered list completeness
    - **Property 4: Rendered list contains all transaction data for every entry**
    - **Validates: Requirements 2.1**

  - [x] 5.5 Implement `renderChart(list, instance)`
    - Computes per-category totals (Food, Transport, Fun)
    - If `list` is empty: hides `<canvas>`, shows `#chart-empty-message`, calls `instance.update()` with zeroed data
    - If `list` is non-empty: shows `<canvas>`, hides `#chart-empty-message`, mutates `instance.data.datasets[0].data` and `instance.data.labels`, then calls `instance.update()`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 5.6 Write property test for chart data aggregation
    - **Property 7: Chart data values equal per-category amount sums**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x] 5.7 Implement top-level `render()`
    - Calls `renderList(transactions)`, `renderBalance(transactions)`, and `renderChart(transactions, chartInstance)` in sequence
    - _Requirements: 3.2, 3.3, 4.2, 4.3_

- [x] 6. Checkpoint — verify rendering pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement add and delete transaction logic (`js/app.js`)
  - [x] 7.1 Implement `addTransaction(name, amount, category)`
    - Creates a transaction object `{ id: Date.now(), name: name.trim(), amount: parseFloat(amount), category }`
    - Unshifts it onto the `transactions` array (index 0)
    - Calls `saveTransactions(transactions)` then `render()`
    - _Requirements: 1.4, 2.3, 5.1_

  - [ ]* 7.2 Write property test for adding a valid transaction
    - **Property 2: Adding a valid transaction grows the list by exactly one and persists it**
    - **Validates: Requirements 1.4, 2.3**

  - [x] 7.3 Implement `deleteTransaction(id)`
    - Filters `transactions` to remove the entry whose `id` matches; logs a warning and returns early if no match is found
    - Calls `saveTransactions(transactions)` then `render()`
    - _Requirements: 2.5, 5.2_

  - [ ]* 7.4 Write property test for delete correctness
    - **Property 5: Deleting a transaction removes exactly that entry and no others**
    - **Validates: Requirements 2.5**

- [x] 8. Implement event handlers and form reset (`js/app.js`)
  - [x] 8.1 Implement `handleFormSubmit(event)`
    - Calls `event.preventDefault()`
    - Reads values from `#item-name`, `#item-amount`, `#item-category`
    - Calls `validateForm()`; on failure writes error messages into `#form-errors` and returns
    - On success clears `#form-errors`, calls `addTransaction()`, then resets the form fields to their default empty/unselected state
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [ ]* 8.2 Write property test for form reset after successful submission
    - **Property 3: Form resets after every successful submission**
    - **Validates: Requirements 1.5**

  - [x] 8.3 Implement delete event delegation on `#transaction-list`
    - Attach a single `click` listener to `#transaction-list`
    - When the clicked element is a delete button, read its `data-id`, parse it as a number, and call `deleteTransaction(id)`
    - _Requirements: 2.5_

- [x] 9. Implement `init()` and wire everything together (`js/app.js`)
  - [x] 9.1 Implement `init()`
    - Calls `loadTransactions()` and assigns the result to `transactions`
    - Checks for `window.Chart`; if present, creates the `chartInstance` on `#spending-chart` with type `"doughnut"` or `"pie"`, initial empty data, and the fixed `backgroundColor` array from `CATEGORY_COLORS`; if absent, hides `#chart-section` and shows a static unavailability message
    - Calls `render()` to populate the UI from the restored state
    - Attaches the `submit` listener on `#expense-form` pointing to `handleFormSubmit`
    - Attaches the `click` delegation listener on `#transaction-list`
    - _Requirements: 2.4, 5.3, 5.4_

  - [ ]* 9.2 Write property test for initialization restoring persisted state
    - **Property 9: Application initialization fully restores persisted state**
    - **Validates: Requirements 5.3**

  - [x] 9.3 Register `init` on `DOMContentLoaded`
    - `document.addEventListener("DOMContentLoaded", init)`
    - _Requirements: 6.1, 6.3_

- [x] 10. Final checkpoint — end-to-end verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Sub-tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties defined in the design document
- All property tests should use a property-based testing library (e.g., fast-check) with a minimum of 100 iterations per property
- No test HTML or JavaScript files should be created as part of this implementation
- The app must work when opened directly from the file system (`file://`) — avoid ES module syntax that requires a server
