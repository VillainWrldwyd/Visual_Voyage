// Generate random stars
const starContainer = document.querySelector(".stars");
const numStars = 150; // adjust for density
let currentSlide = 0; // start at slide 0

for (let i = 0; i < numStars; i++) {
  const star = document.createElement("div");
  star.className = "star";
  star.style.top = Math.random() * 100 + "%";
  star.style.left = Math.random() * 100 + "%";
  star.style.animationDuration = Math.random() * 3 + 2 + "s";
  starContainer.appendChild(star);
}

// Helix section global function
function showSectionLoader(id) {
  const loader = document.getElementById(id);
  if (loader) loader.style.display = "flex";
}

function hideSectionLoader(id) {
  const loader = document.getElementById(id);
  if (loader) loader.style.display = "none";
}
//** */

// nav and side menu toggle
document.getElementById("navToggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("active");
});
//** */

// Fetching Account performance data
// Fetch real trade data from backend
// Map numeric trade types to readable labels
function mapTradeType(type) {
  switch (type) {
    case 0:
      return "Buy";
    case 1:
      return "Sell";
    case 2:
      return "Balance";
    default:
      return "Unknown";
  }
}

// Fetch trading logs from backend
async function loadTrades() {
  showSectionLoader("tradeLoader");
  try {
    const res = await fetch("http://localhost:5000/trades");
    const trades = await res.json();

    const table = document.querySelector("#trades table");
    table.innerHTML = `
    <tr>
      <th>Symbol</th>
      <th>Type</th>
      <th>Volume</th>
      <th>Price</th>
      <th>Profit</th>
    </tr>
  `;

    trades.forEach((trade) => {
      const row = document.createElement("tr");
      row.innerHTML = `
      <td>${trade.symbol}</td>
      <td>${mapTradeType(trade.type)}</td>
      <td>${trade.volume}</td>
      <td>${trade.price}</td>
      <td>${trade.profit}</td>
    `;
      table.appendChild(row);
    });
  } catch (err) {
    console.error("Error Loading trades:", err);
  } finally {
    hideSectionLoader("tradeLoader");
  }
}

// Fetch portfolio data from backend
async function loadPortfolio() {
  const res = await fetch("http://localhost:5000/portfolio");
  if (!res.ok) {
    console.error("Failed to load portfolio:", res.status);
    return;
  }
  const portfolio = await res.json();

  const table = document.querySelector("#portfolioContent table");
  if (!table) return;

  table.innerHTML = `
    <tr>
      <th>Symbol</th>
      <th>Entry</th>
      <th>Volume</th>
      <th>Price</th>
      <th>Profit</th>
    </tr>
  `;

  portfolio.forEach((pos) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${pos.symbol}</td>
      <td>${mapTradeType(pos.entry)}</td>
      <td>${pos.volume}</td>
      <td>${pos.price}</td>
      <td>${pos.profit}</td>
    `;
    table.appendChild(row);
  });
}

// Fetch performance metrics from backend
async function loadPerformance() {
  try {
    const res = await fetch("http://localhost:5000/performance");
    const perf = await res.json();

    if (perf.error) {
      document.getElementById("performanceContent").innerHTML =
        `<div>${perf.error}</div>`;
      return;
    }

    document.getElementById("performanceContent").innerHTML = `
      <div>Total PnL: $${perf.total_pnl}</div>
      <div>Win Rate: ${perf.win_rate}%</div>
      <div>Max Drawdown: ${perf.max_drawdown}%</div>
    `;
  } catch (err) {
    console.error("Performance fetch failed:", err);
    document.getElementById("performanceContent").innerHTML =
      "<div>Error loading performance data</div>";
  }
}

// Fetch and render equity curve
let analyticsChartInstance = null;

async function showEquity() {
  const res = await fetch("http://localhost:5000/performance");
  const perf = await res.json();

  if (analyticsChartInstance) analyticsChartInstance.destroy();

  const ctx = document.getElementById("analyticsChart").getContext("2d");
  analyticsChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: perf.equity_curve.map((_, i) => i + 1),
      datasets: [
        {
          label: "Equity Curve",
          data: perf.equity_curve,
          borderColor: "#1a73e8",
          backgroundColor: "rgba(26,115,232,0.1)",
          fill: true,
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

async function showMonthly() {
  const res = await fetch("http://localhost:5000/monthly_performance");
  const monthly = await res.json();

  if (analyticsChartInstance) analyticsChartInstance.destroy();

  const ctx = document.getElementById("analyticsChart").getContext("2d");
  analyticsChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(monthly),
      datasets: [
        {
          label: "Monthly PnL",
          data: Object.values(monthly),
          backgroundColor: "#1a73e8",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false, position: "top" } },
    },
  });
}
//** */

// Call render functions on page load
function renderPortfolio() {
  const portfolio = {};

  mockTrades.forEach((t) => {
    if (!portfolio[t.symbol]) portfolio[t.symbol] = { volume: 0, cost: 0 };
    if (t.type === "buy") {
      portfolio[t.symbol].volume += t.volume;
      portfolio[t.symbol].cost += t.volume * t.price;
    } else {
      portfolio[t.symbol].volume -= t.volume;
      portfolio[t.symbol].cost -= t.volume * t.price;
    }
  });

  const portfolioContent = document.getElementById("portfolioContent");
  portfolioContent.innerHTML = Object.keys(portfolio)
    .map((symbol) => {
      const avgCost =
        portfolio[symbol].volume > 0
          ? (portfolio[symbol].cost / portfolio[symbol].volume).toFixed(2)
          : 0;
      return `<div class="portfolio-item">${symbol}: ${portfolio[symbol].volume} lots @ avg ${avgCost}</div>`;
    })
    .join("");
}

// Symbol Table & Pie Chart
// Calculate total profits and losses across all symbols
let symbolChartInstance = null;
async function loadSymbolStats() {
  try {
    const res = await fetch("http://localhost:5000/symbol_stats");
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const stats = await res.json();

    if (stats.error) {
      document.getElementById("symbolStats").innerHTML =
        `<div>${stats.error}</div>`;
      return;
    }

    const symbols = Object.entries(stats);

    // ✅ Calculate total profits and losses here
    let totalProfit = 0;
    let totalLoss = 0;

    for (const [sym, data] of symbols) {
      if (data.pnl > 0) {
        totalProfit += data.pnl;
      } else if (data.pnl < 0) {
        totalLoss += Math.abs(data.pnl);
      }
    }

    // ✅ Destroy old chart
    if (symbolChartInstance) symbolChartInstance.destroy();

    const ctx = document.getElementById("symbolChart").getContext("2d");
    symbolChartInstance = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Profits", "Losses"],
        datasets: [
          {
            data: [totalProfit, totalLoss],
            backgroundColor: ["#4caf50", "#f44336"],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "right" } },
      },
    });

    // ✅ Stats table stays the same
    let html = `
      <table class="stats-table">
        <tr><th>Symbol</th><th>Wins</th><th>Losses</th><th>Total Trades</th></tr>
      ${symbols
        .map(
          ([sym, data]) => `
        <tr>
          <td>${sym}</td>
          <td>${data.wins}</td>
          <td>${data.losses}</td>
          <td>${data.count}</td>
        </tr>`,
        )
        .join("")}
      </table>
    `;
    document.getElementById("symbolStats").innerHTML = html;
  } catch (err) {
    console.error("Symbol stats fetch failed:", err);
    document.getElementById("symbolStats").innerHTML =
      "<div>Error loading symbol stats</div>";
  }
}

// Calendar Heatmap
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

function renderWeekdays() {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const container = document.getElementById("calendarWeekdays");
  container.innerHTML = "";
  weekdays.forEach((day) => {
    const cell = document.createElement("div");
    cell.textContent = day;
    container.appendChild(cell);
  });
}

async function loadCalendar(year = currentYear, month = currentMonth) {
  const res = await fetch(
    `http://localhost:5000/daily_activity?year=${year}&month=${month + 1}`,
  );
  const daily = await res.json();

  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  document.getElementById("monthLabel").textContent = new Date(
    year,
    month,
  ).toLocaleString("default", { month: "long", year: "numeric" });

  let totalPnL = 0,
    activeDays = 0;

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell neutral-day";
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const pnl = daily[dateKey] ? daily[dateKey].pnl : 0;

    let activityClass =
      pnl > 0 ? "profit-day" : pnl < 0 ? "loss-day" : "neutral-day";
    if (pnl !== 0) {
      totalPnL += pnl;
      activeDays++;
    }

    const cell = document.createElement("div");
    cell.className = `day-cell ${activityClass}`;
    cell.innerHTML = `<div>${d}</div><div>${pnl.toFixed(2)}</div>`;
    cell.title = `PnL: ${pnl.toFixed(2)}`;
    grid.appendChild(cell);
  }

  document.getElementById("monthPnL").innerHTML =
    `<i class="fas fa-chart-line"></i> PnL: $${totalPnL.toFixed(2)}`;
  document.getElementById("monthDays").innerHTML =
    `<i class="fas fa-calendar-day"></i> Days: ${activeDays}`;
}

// Navigation
document.getElementById("prevMonth").addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  loadCalendar(currentYear, currentMonth);
});
document.getElementById("nextMonth").addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  loadCalendar(currentYear, currentMonth);
});
document.getElementById("todayBtn").addEventListener("click", () => {
  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth();
  loadCalendar(currentYear, currentMonth);
});
/** */

///*** NEW CONTENT */
/* Playbooks*/
let strategies = [];
let strategyChart;

function addStrategy() {
  const input = document.getElementById("strategyInput");
  const name = input.value.trim();
  if (!name) return;
  strategies.push({ name, trades: [], profit: 0 });
  input.value = "";
  renderPlaybooks();
}

function renderPlaybooks() {
  const list = document.getElementById("playbookList");
  list.innerHTML = "";
  strategies.forEach((s) => {
    const div = document.createElement("div");
    div.className = "playbook-card";
    div.innerHTML = `
      <h3>${s.name}</h3>
      <p>Trades tagged: ${s.trades.length}</p>
      <p>Total Profit: ${s.profit}</p>
    `;
    list.appendChild(div);
  });
  renderStrategyPerformance();
}

function renderStrategyPerformance() {
  const ctx = document.getElementById("strategyPerformance").getContext("2d");
  if (strategyChart) strategyChart.destroy();
  strategyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: strategies.map((s) => s.name),
      datasets: [
        {
          label: "Profit per Strategy",
          data: strategies.map((s) => s.profit),
          backgroundColor: "#1a73e8",
        },
      ],
    },
  });
}

// Later: fetch MT5 trades and tag them with strategies
async function loadPlaybooks() {
  showSectionLoader("playbookLoader");
  try {
    const res = await fetch("/trades"); // MT5 trades route
    const trades = await res.json();
    hideSectionLoader("playbookLoader");

    // Example: auto‑tagging by symbol (replace with real logic)
    trades.forEach((t) => {
      let strat = strategies.find((s) => s.name === "Breakout");
      if (strat) {
        strat.trades.push(t);
        strat.profit += t.profit;
      }
    });
    renderPlaybooks();
  } catch (err) {
    console.error("Failed to load playbooks:", err);
  }
}

//** */

///***RENDER ON UI */
// Display Render on page
function initDashboard() {
  mapTradeType();
  loadTrades();
  loadPortfolio();
  loadPerformance();
  showEquity();
  loadSymbolStats();
  loadCalendar();
  renderWeekdays();
  // Render new content
  loadPlaybooks();
  // Auto-refresh every 60 seconds
  setInterval(() => {
    loadTrades();
    mapTradeType();
    loadPortfolio();
    loadPerformance();
    showEquity();
    loadSymbolStats();
    loadCalendar();
    renderWeekdays();
    // new content
    loadPlaybooks();
  }, 60000);
}
initDashboard();
//**  */

// Trade Tracker app//
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("APPjson/service-worker.js")
    .then((reg) => console.log("Service Worker registered:", reg))
    .catch((err) => console.log("Service Worker failed:", err));
}

//**  */

//**Animations */
// Initialize first slide
document.addEventListener("DOMContentLoaded", () => {
  showSlide(currentSlide);
});

// Loader hide on page load
window.addEventListener("load", () => {
  document.getElementById("loader").style.display = "none";
});

// Remove skeleton after loading
window.addEventListener("load", () => {
  document.querySelectorAll(".skeleton").forEach((el) => {
    el.classList.remove("skeleton");
  });
});

// Initialize first slide
showSlide(currentSlide);

function showSlide(index) {
  console.log("showSlide called with index:", index);
}
